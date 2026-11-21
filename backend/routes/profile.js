const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// Helper to determine if a user record is HR
const isUserHR = (u) =>
  u?.role === 'hr' ||
  u?.role === 'manager' ||
  u?.username === 'hr' ||
  u?.username === 'hrr';

// 1. Get all employees directory for HR with onboarding & verification status + salary
// NOTE: Must be defined before `/:userId` route to prevent matching 'all' as userId
router.get('/all/directory', async (req, res) => {
  try {
    const isHR = req.query.isHR === 'true' || req.query.role === 'hr' || req.query.role === 'manager';
    if (!isHR) {
      return res.status(403).json({ success: false, error: 'Access Denied: Only HR administrators can view employee verification records.' });
    }

    // Only employees who have filled in their personal details (is_profile_completed = 1) come to HR for verification
    const [rows] = await pool.query(
      `SELECT u.id as user_id, u.username, u.emp_id, u.name, u.role, u.is_profile_completed,
              ep.id as profile_id, ep.first_name, ep.last_name, ep.gender,
              DATE_FORMAT(ep.dob, '%Y-%m-%d') as dob, ep.aadhaar_no, ep.father_name,
              ep.mobile, ep.official_email, ep.address, ep.city, ep.home_state,
              ep.blood_group, ep.emergency_contact_person, ep.emergency_contact_relation,
              ep.emergency_contact_number, ep.department, ep.designation,
              ep.salary,
              COALESCE(ep.verification_status, 'pending') as verification_status,
              COALESCE(ep.is_verified, 0) as is_verified,
              ep.updated_at
       FROM users u
       INNER JOIN employee_profiles ep ON u.id = ep.user_id
       WHERE u.is_profile_completed = 1
         AND u.role != 'manager' AND u.role != 'hr' AND u.username != 'hr' AND u.username != 'hrr'
       ORDER BY ep.is_verified ASC, ep.updated_at DESC`
    );

    res.json({
      success: true,
      employees: rows.map((r) => ({
        ...r,
        is_verified: Boolean(r.is_verified),
      })),
    });
  } catch (error) {
    console.error('[Profile Route] Directory error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employee directory' });
  }
});

// 2. HR Verify employee profile & assign salary
router.post('/verify', async (req, res) => {
  try {
    const { userId, salary } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'Target employee User ID is required' });
    }
    if (!salary || !String(salary).trim()) {
      return res.status(400).json({ success: false, error: 'Salary amount is required to verify the employee' });
    }

    const cleanSalary = String(salary).trim();

    // Check if employee profile exists
    const [profileRows] = await pool.query(
      'SELECT id, user_id, emp_id FROM employee_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    if (profileRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Employee has not completed their onboarding profile details yet.',
      });
    }

    // Update profile to verified status and store salary
    await pool.query(
      `UPDATE employee_profiles
       SET salary = ?,
           verification_status = 'verified',
           is_verified = 1
       WHERE user_id = ?`,
      [cleanSalary, userId]
    );

    console.log(`[Profile Route] Employee #${userId} verified by HR with salary: ${cleanSalary}`);

    res.json({
      success: true,
      message: 'Employee profile successfully verified and salary assigned.',
      salary: cleanSalary,
      verificationStatus: 'verified',
      isVerified: true,
    });
  } catch (error) {
    console.error('[Profile Route] Verify error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify employee profile' });
  }
});

// 3. HR Edit / Update salary directly
router.post('/update-salary', async (req, res) => {
  try {
    const { userId, salary } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'Target employee User ID is required' });
    }
    if (!salary || !String(salary).trim()) {
      return res.status(400).json({ success: false, error: 'Salary is required' });
    }

    const cleanSalary = String(salary).trim();

    await pool.query(
      `UPDATE employee_profiles
       SET salary = ?
       WHERE user_id = ?`,
      [cleanSalary, userId]
    );

    res.json({
      success: true,
      message: 'Salary updated successfully.',
      salary: cleanSalary,
    });
  } catch (error) {
    console.error('[Profile Route] Update salary error:', error);
    res.status(500).json({ success: false, error: 'Failed to update employee salary' });
  }
});

// 4. Get employee profile by userId
// NOTE: For HR, verification is NOT needed.
// NOTE: For normal employees, salary is NEVER returned!
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const isHRRequester = req.query.isHR === 'true' || req.query.role === 'hr' || req.query.role === 'manager';

    // Fetch user from users table
    const [userRows] = await pool.query(
      'SELECT id, username, emp_id, name, role, is_profile_completed FROM users WHERE id = ? OR emp_id = ? LIMIT 1',
      [userId, userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userRows[0];
    const userIsHR = isUserHR(user);

    // If target user is HR, verification is not applicable
    if (userIsHR) {
      return res.json({
        success: true,
        empId: user.emp_id,
        isProfileCompleted: true,
        isVerified: true,
        verificationStatus: 'hr_admin',
        user: {
          id: user.id,
          username: user.username,
          empId: user.emp_id,
          name: user.name,
          role: user.role,
          isVerified: true,
        },
        profile: null,
      });
    }

    // Fetch existing profile if available
    const [profileRows] = await pool.query(
      `SELECT id, user_id, emp_id, first_name, last_name, gender,
              DATE_FORMAT(dob, '%Y-%m-%d') AS dob,
              aadhaar_no, father_name, mobile, official_email, address, city, home_state,
              blood_group, emergency_contact_person, emergency_contact_relation,
              emergency_contact_number, department, designation, salary,
              verification_status, is_verified,
              created_at, updated_at
       FROM employee_profiles
       WHERE user_id = ?
       LIMIT 1`,
      [user.id]
    );

    const hasProfile = profileRows.length > 0;
    let profile = hasProfile ? { ...profileRows[0] } : null;

    if (profile) {
      profile.is_verified = Boolean(profile.is_verified);
      // Once HR has seeded/verified the employee profile, employee CAN see their salary.
      // If NOT yet verified by HR, omit salary until HR seeds it.
      if (!isHRRequester && !profile.is_verified) {
        delete profile.salary;
      }
    }

    const isVerified = Boolean(profile?.is_verified) || profile?.verification_status === 'verified';

    res.json({
      success: true,
      empId: user.emp_id,
      isProfileCompleted: Boolean(user.is_profile_completed) || hasProfile,
      isVerified,
      verificationStatus: isVerified ? 'verified' : (profile?.verification_status || 'pending'),
      user: {
        id: user.id,
        username: user.username,
        empId: user.emp_id,
        name: user.name,
        role: user.role,
        isVerified,
      },
      profile,
    });
  } catch (error) {
    console.error('[Profile Route] Fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch employee profile' });
  }
});

// 5. Save / Complete employee profile (Mandatory Onboarding Gate)
router.post('/save', async (req, res) => {
  try {
    const {
      userId,
      firstName,
      lastName,
      gender,
      dob,
      aadhaarNo,
      fatherName,
      mobile,
      officialEmail,
      address,
      city,
      homeState,
      bloodGroup,
      emergencyPerson,
      emergencyRelation,
      emergencyNumber,
      department,
      designation,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    // Required fields validation
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ success: false, error: 'First Name is required' });
    }
    if (!gender) {
      return res.status(400).json({ success: false, error: 'Gender is required' });
    }
    if (!dob) {
      return res.status(400).json({ success: false, error: 'Date of Birth is required' });
    }
    if (!aadhaarNo || aadhaarNo.replace(/\s+/g, '').length < 12) {
      return res.status(400).json({ success: false, error: 'A valid 12-digit Aadhaar Number is required' });
    }
    if (!mobile || mobile.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, error: 'A valid 10-digit Mobile Number is required' });
    }
    if (!city || !city.trim()) {
      return res.status(400).json({ success: false, error: 'City / Nativity is required' });
    }
    if (!homeState) {
      return res.status(400).json({ success: false, error: 'Home State is required' });
    }
    if (!bloodGroup) {
      return res.status(400).json({ success: false, error: 'Blood Group is required' });
    }
    if (!emergencyPerson || !emergencyPerson.trim()) {
      return res.status(400).json({ success: false, error: 'Emergency Contact Person is required' });
    }
    if (!emergencyNumber || emergencyNumber.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ success: false, error: 'Emergency Contact Number must be at least 10 digits' });
    }
    if (!department) {
      return res.status(400).json({ success: false, error: 'Department is required' });
    }
    if (!designation || !designation.trim()) {
      return res.status(400).json({ success: false, error: 'Designation / Role is required' });
    }

    // Fetch authentic emp_id from DB
    const [userRows] = await pool.query(
      'SELECT id, username, emp_id, name, role FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, error: 'User record not found' });
    }

    const verifiedEmpId = userRows[0].emp_id;
    const cleanFirstName = firstName.trim();
    const cleanLastName = (lastName || '').trim();
    const cleanFullName = cleanLastName ? `${cleanFirstName} ${cleanLastName}` : cleanFirstName;
    const cleanAadhaar = aadhaarNo.replace(/\s+/g, '').slice(0, 12);
    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    const cleanEmergencyNum = emergencyNumber.replace(/\D/g, '').slice(-10);

    // Insert or Update employee_profiles (Initial verification_status is 'pending')
    await pool.query(
      `INSERT INTO employee_profiles (
        user_id, emp_id, first_name, last_name, gender, dob, aadhaar_no,
        father_name, mobile, official_email, address, city, home_state, blood_group,
        emergency_contact_person, emergency_contact_relation, emergency_contact_number,
        department, designation, verification_status, is_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
      ON DUPLICATE KEY UPDATE
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        gender = VALUES(gender),
        dob = VALUES(dob),
        aadhaar_no = VALUES(aadhaar_no),
        father_name = VALUES(father_name),
        mobile = VALUES(mobile),
        official_email = VALUES(official_email),
        address = VALUES(address),
        city = VALUES(city),
        home_state = VALUES(home_state),
        blood_group = VALUES(blood_group),
        emergency_contact_person = VALUES(emergency_contact_person),
        emergency_contact_relation = VALUES(emergency_contact_relation),
        emergency_contact_number = VALUES(emergency_contact_number),
        department = VALUES(department),
        designation = VALUES(designation)`,
      [
        userId,
        verifiedEmpId,
        cleanFirstName,
        cleanLastName,
        gender,
        dob,
        cleanAadhaar,
        (fatherName || '').trim(),
        cleanMobile,
        (officialEmail || '').trim().toLowerCase(),
        (address || '').trim(),
        city.trim(),
        homeState.trim(),
        bloodGroup.trim(),
        emergencyPerson.trim(),
        emergencyRelation || 'Father',
        cleanEmergencyNum,
        department.trim(),
        designation.trim(),
      ]
    );

    // Update users table: mark profile as completed and sync full name
    await pool.query(
      'UPDATE users SET is_profile_completed = 1, name = ? WHERE id = ?',
      [cleanFullName, userId]
    );

    console.log(`[Profile Route] Profile submitted for user #${userId} (${verifiedEmpId} - ${cleanFullName})`);

    const updatedUser = {
      id: userRows[0].id,
      username: userRows[0].username,
      empId: verifiedEmpId,
      name: cleanFullName,
      role: userRows[0].role,
      isProfileCompleted: true,
      isVerified: false,
      verificationStatus: 'pending',
      department: department.trim(),
      designation: designation.trim(),
    };

    res.json({
      success: true,
      message: 'Employee profile submitted successfully. Pending HR verification & salary assignment.',
      empId: verifiedEmpId,
      isProfileCompleted: true,
      isVerified: false,
      verificationStatus: 'pending',
      user: updatedUser,
    });
  } catch (error) {
    console.error('[Profile Route] Save error:', error);
    res.status(500).json({ success: false, error: 'Failed to save employee profile details' });
  }
});

module.exports = router;
