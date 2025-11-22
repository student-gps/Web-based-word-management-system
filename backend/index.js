const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid'); // 引入 uuid 模块

// const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// MySQL 数据库连接配置
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '!Gps108577180', // 替换为你的密码
  database: 'graduation_project'
});

// 连接数据库
db.connect((err) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  console.log('已连接到 MySQL 数据库');
});

// 用户登录
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  console.log('收到登录请求:', { username });

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const sql = 'SELECT * FROM user_info WHERE 学号 = ?';
  db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error('查询错误:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: '用户名不存在' });
    }

    const user = results[0];

    // 如果密码是明文，直接比较
    if (password !== user.密码) {
      return res.status(401).json({ error: '密码错误' });
    }

    // 如果使用 bcrypt（生产环境）
    /*
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: '密码错误' });
    }
    */

    // 登录成功，返回用户信息
    res.json({
      message: '登录成功',
      user: {
        id: user.学号,
        name: user.姓名,
        group: user.组别,
        role: user.身份,
        major: user.专业,
        section: user.班级,
      }
    });
  });
});

// 获取所有请假申请（可选，用于调试）
app.get('/api/leave-applications', (req, res) => {
  const sql = 'SELECT * FROM leave_applications;';
  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    } 
    res.json(results);
  });
});


// 工作流第一部分 - 学生提交请假申请
app.post('/api/leave_application_student', (req, res) => {
  const {
    studentName,
    studentId,
    major,
    section,
    telephone,
    startDate,
    endDate,
    totalDays,
  } = req.body;

  // 生成 UUID
  const applicationId = uuidv4();

  const sql = `
    INSERT INTO leave_applications (
      单号, 申请人, 学号, 专业, 班级, 电话, 开始日期, 结束日期, 总时间
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `;
  const values = [
    applicationId,
    studentName,
    studentId,
    major,
    section,
    telephone,
    startDate,
    endDate,
    totalDays,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('数据库插入错误:', err); // 记录完整错误对象
      return res.status(500).json({ error: '数据库错误', details: err.message });
    }
    res.json({
      id: result.insertId,
      applicationId, // 返回生成的 UUID
      studentName,
      studentId,
      major,
      section,
      telephone,
      startDate,
      endDate,
      totalDays,
    });
  });
});

// 工作流第二部分 - 辅导员审批（修改为类似第一部分的写法）
app.post('/api/leave_application_counselor', (req, res) => {
  const {
    applicationId,
    辅导员意见,
  } = req.body;
  const 辅导员审批时间 = new Date().toISOString().split('T')[0];

  // 输入验证
  if (!applicationId || !辅导员意见 || !['y', 'n'].includes(辅导员意见)) {
    return res.status(400).json({ error: '请提供有效的申请ID和辅导员意见（y 或 n）' });
  }

  const sql = `
    UPDATE leave_applications 
    SET 辅导员意见 = ?, 
        辅导员审批时间 = ?
    WHERE 单号 = ?;
  `;

  db.query(sql, [辅导员意见, 辅导员审批时间, applicationId], (err, result) => {
    if (err) {
      console.error('数据库更新错误:', err);
      return res.status(500).json({ error: '数据库错误', details: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: `未找到对应的请假申请，单号: ${applicationId}` });
    }

    // 查询更新后的完整数据
    db.query('SELECT * FROM leave_applications WHERE 单号 = ?', [applicationId], (err, results) => {
      if (err) {
        console.error('查询申请数据错误:', err);
        return res.status(500).json({ error: '数据库错误', details: err.message });
      }

      res.json({
        success: true,
        message: '辅导员意见已更新',
        applicationId,
        辅导员意见,
        辅导员审批时间,
        ...results[0] // 返回完整记录
      });
    });
  });
});

// 工作流第三部分 - 主任审批
app.post('/api/leave_application_director', (req, res) => {
  const {
    applicationId,
    主任意见,
  } = req.body;
  const 主任审批时间 = new Date().toISOString().split('T')[0];

  // 输入验证
  if (!applicationId || !主任意见 || !['y', 'n'].includes(主任意见)) {
    return res.status(400).json({ error: '请提供有效的申请ID和主任意见（y 或 n）' });
  }

  const sql = `
    UPDATE leave_applications 
    SET 主任意见 = ?, 
        主任审批时间 = ?
    WHERE 单号 = ?;
  `;

  db.query(sql, [主任意见, 主任审批时间, applicationId], (err, result) => {
    if (err) {
      console.error('数据库更新错误:', err);
      return res.status(500).json({ error: '数据库错误', details: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: `未找到对应的请假申请，单号: ${applicationId}` });
    }

    // 查询更新后的完整数据
    db.query('SELECT * FROM leave_applications WHERE 单号 = ?', [applicationId], (err, results) => {
      if (err) {
        console.error('查询申请数据错误:', err);
        return res.status(500).json({ error: '数据库错误', details: err.message });
      }

      res.json({
        success: true,
        message: '主任意见已更新',
        applicationId,
        主任意见,
        主任审批时间,
        ...results[0] // 返回完整记录
      });
    });
  });
});

// 工作流第四部分 - 续假信息提交
app.post('/api/leave_application_extension', (req, res) => {
  const {
    applicationId,
    是否续假,
    续假天数,
    销假时间
  } = req.body;

  if (!applicationId || !是否续假 || !['y', 'n'].includes(是否续假) || (是否续假 === 'y' && (!续假天数 || !销假时间))) {
    return res.status(400).json({ error: '请提供有效的申请ID、是否续假（y 或 n）、续假天数和销假时间' });
  }

  const sql = `
    UPDATE leave_applications 
    SET 是否续假 = ?, 
        续假天数 = ?,
        办理销假时间 = ?
    WHERE 单号 = ?;
  `;

  db.query(sql, [是否续假, 续假天数, 销假时间, applicationId], (err, result) => {
    if (err) {
      console.error('数据库更新错误:', err);
      return res.status(500).json({ error: '数据库错误', details: err.message });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: `未找到对应的请假申请，单号: ${applicationId}` });
    }

    db.query('SELECT * FROM leave_applications WHERE 单号 = ?', [applicationId], (err, results) => {
      if (err) {
        console.error('查询申请数据错误:', err);
        return res.status(500).json({ error: '数据库错误', details: err.message });
      }

      res.json({
        success: true,
        message: '续假信息已更新',
        applicationId,
        是否续假,
        续假天数,
        销假时间,
        ...results[0]
      });
    });
  });
});

// 启动服务器
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});