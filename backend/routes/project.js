const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// 1. Get all projects with employee headcount & assigned members
router.get('/', async (req, res) => {
  try {
    const [projects] = await pool.query(`
      SELECT p.id, p.name, p.code, p.client, p.description, p.color, p.status, p.created_at,
             COUNT(ep.id) AS member_count
      FROM projects p
      LEFT JOIN employee_projects ep ON p.id = ep.project_id
      GROUP BY p.id
      ORDER BY p.name ASC
    `);

    // Fetch members for each project
    const [allMembers] = await pool.query(`
      SELECT ep.project_id, ep.user_id, ep.role_in_project, ep.assigned_at,
             u.name, u.emp_id, u.username
      FROM employee_projects ep
      JOIN users u ON ep.user_id = u.id
      ORDER BY u.name ASC
    `);

    const membersByProject = {};
    for (const m of allMembers) {
      if (!membersByProject[m.project_id]) {
        membersByProject[m.project_id] = [];
      }
      membersByProject[m.project_id].push({
        userId: m.user_id,
        name: m.name,
        empId: m.emp_id,
        username: m.username,
        roleInProject: m.role_in_project || 'Member',
        assignedAt: m.assigned_at,
      });
    }

    const result = projects.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      client: p.client || 'Tech Sigaram',
      description: p.description || '',
      color: p.color || '#EA580C',
      status: p.status || 'active',
      createdAt: p.created_at,
      memberCount: Number(p.member_count) || 0,
      members: membersByProject[p.id] || [],
    }));

    res.json({
      success: true,
      count: result.length,
      projects: result,
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// 2. Get project mapped to a specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [rows] = await pool.query(`
      SELECT p.id, p.name, p.code, p.client, p.description, p.color, p.status,
             ep.role_in_project, ep.assigned_at
      FROM employee_projects ep
      JOIN projects p ON ep.project_id = p.id
      JOIN users u ON ep.user_id = u.id
      WHERE ep.user_id = ? OR u.emp_id = ? OR LOWER(u.username) = LOWER(?) OR LOWER(u.name) = LOWER(?)
      LIMIT 1
    `, [userId, userId, userId, userId]);

    if (rows.length === 0) {
      return res.json({
        success: true,
        project: null,
      });
    }

    const row = rows[0];
    res.json({
      success: true,
      project: {
        id: row.id,
        name: row.name,
        code: row.code,
        client: row.client || 'Tech Sigaram',
        description: row.description || '',
        color: row.color || '#EA580C',
        status: row.status || 'active',
        roleInProject: row.role_in_project || 'Member',
        assignedAt: row.assigned_at,
      },
    });
  } catch (error) {
    console.error('Error fetching user project:', error);
    res.status(500).json({ error: 'Failed to fetch employee project' });
  }
});

// 3. Map / Assign an employee to a project (HR Action)
router.post('/assign', async (req, res) => {
  try {
    const { userId, projectId, roleInProject } = req.body;

    if (!userId || !projectId) {
      return res.status(400).json({ error: 'User ID and Project ID are required' });
    }

    // Verify user exists
    const [userRows] = await pool.query('SELECT id, name, emp_id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Verify project exists
    const [projectRows] = await pool.query('SELECT id, name, code, color, client FROM projects WHERE id = ?', [projectId]);
    if (projectRows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const assignedRole = (roleInProject && roleInProject.trim()) || 'Member';

    // Remove any previous project assignment for this employee
    await pool.query('DELETE FROM employee_projects WHERE user_id = ?', [userId]);

    // Insert new assignment
    const [insertResult] = await pool.query(
      'INSERT INTO employee_projects (user_id, project_id, role_in_project) VALUES (?, ?, ?)',
      [userId, projectId, assignedRole]
    );

    const targetUser = userRows[0];
    const targetProject = projectRows[0];

    res.json({
      success: true,
      message: `${targetUser.name} mapped to ${targetProject.name} successfully`,
      data: {
        id: insertResult.insertId,
        userId: targetUser.id,
        employeeName: targetUser.name,
        empId: targetUser.emp_id,
        projectId: targetProject.id,
        projectName: targetProject.name,
        projectCode: targetProject.code,
        projectColor: targetProject.color,
        client: targetProject.client,
        roleInProject: assignedRole,
      },
    });
  } catch (error) {
    console.error('Error assigning employee to project:', error);
    res.status(500).json({ error: 'Failed to map employee to project' });
  }
});

// 4. Unassign an employee from their project (HR Action)
router.post('/unassign', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    await pool.query('DELETE FROM employee_projects WHERE user_id = ?', [userId]);

    res.json({
      success: true,
      message: 'Employee unassigned from project successfully',
      data: { userId },
    });
  } catch (error) {
    console.error('Error unassigning employee:', error);
    res.status(500).json({ error: 'Failed to unassign employee' });
  }
});

// 5. Create a new project (HR Action)
router.post('/', async (req, res) => {
  try {
    const { name, code, client, description, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const projectCode = (code && code.trim()) || `PRJ-${String(name.trim().toUpperCase().replace(/\s+/g, '').slice(0, 6))}-${Math.floor(100 + Math.random() * 900)}`;
    const projectColor = color || '#EA580C';
    const clientName = (client && client.trim()) || 'Tech Sigaram';
    const projectDesc = description || '';

    // Check code collision
    const [existing] = await pool.query('SELECT id FROM projects WHERE code = ?', [projectCode]);
    if (existing.length > 0) {
      return res.status(400).json({ error: `Project code '${projectCode}' is already in use` });
    }

    const [result] = await pool.query(
      'INSERT INTO projects (name, code, client, description, color, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), projectCode, clientName, projectDesc, projectColor, 'active']
    );

    const newProject = {
      id: result.insertId,
      name: name.trim(),
      code: projectCode,
      client: clientName,
      description: projectDesc,
      color: projectColor,
      status: 'active',
      memberCount: 0,
      members: [],
    };

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project: newProject,
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

module.exports = router;
