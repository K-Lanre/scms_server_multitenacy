const { Meeting, MeetingMinute, User, Notification } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { Op } = require('sequelize');
const socketIO = require('../utils/socket');
const { attachInstitution } = require('../middleware/tenantMiddleware');


/**
 * Admin: Schedule a meeting
 */
exports.scheduleMeeting = catchAsync(async (req, res, next) => {
  const { date } = req.body;
  if (new Date(date) < new Date().setHours(0, 0, 0, 0)) {
    return next(new AppError("A meeting cannot be scheduled for a previous day.", 400));
  }

  const meeting = await Meeting.create({
    ...req.body,
    institutionId: req.user.institutionId,
    status: 'scheduled'
  });

  // Notify all members (in a real app, this might be a background job)
  const members = await User.findAll({ where: { role: 'member', status: 'active', ...attachInstitution(req) } });
  
  const notifications = members.map(m => ({
    userId: m.id,
    title: 'New Meeting Scheduled',
    message: `${meeting.type.toUpperCase()} Meeting: ${meeting.title} on ${meeting.date} at ${meeting.time}`,
    type: 'info',
    link: '/meetings'
  }));

  await Notification.bulkCreate(notifications);

  // Individual real-time notifications for immediate UI update in NotificationBell
  members.forEach(member => {
    socketIO.emitToUser(member.id, 'new_notification', {
        id: `meeting-${meeting.id}-${Date.now()}`,
        title: 'New Meeting Scheduled',
        message: `${meeting.type.toUpperCase()} Meeting: ${meeting.title}`,
        type: 'info',
        link: '/meetings',
        createdAt: new Date()
    });
  });

  // Real-time broadcast to all members
  socketIO.broadcast('notification_sync', {
    type: 'new_meeting',
    meetingTitle: meeting.title,
    date: meeting.date
  });

  res.status(201).json({
    status: 'success',
    data: { meeting }
  });
});

/**
 * Admin: Record minutes & complete meeting
 */
exports.recordMinutes = catchAsync(async (req, res, next) => {
  const { meetingId } = req.params;
  const { content, fileUrl, attendanceCount } = req.body;

  const meeting = await Meeting.findOne({ where: { id: meetingId, ...attachInstitution(req) } });
  if (!meeting) return next(new AppError('Meeting not found', 404));

  // 1. Create/Update Minutes
  let minute = await MeetingMinute.findOne({ where: { meetingId } });
  if (minute) {
    await minute.update({ content, fileUrl, attendanceCount, recordedBy: req.user.id });
  } else {
    minute = await MeetingMinute.create({
      meetingId,
      content,
      fileUrl,
      attendanceCount,
      recordedBy: req.user.id
    });
  }

  // 2. Mark meeting as completed
  await meeting.update({ status: 'completed' });

  res.status(200).json({
    status: 'success',
    data: { minute, meeting }
  });
});

/**
 * Common: Get meetings (Optionally filter by upcoming/past)
 */
exports.getAllMeetings = catchAsync(async (req, res, next) => {
  const { filter } = req.query; // 'upcoming' or 'past'
  let where = attachInstitution(req);
  
  if (filter === 'upcoming') {
    where = { 
      [Op.or]: [
        { status: 'scheduled' },
        { date: { [Op.gte]: new Date().toISOString().split('T')[0] } }
      ]
    };
  } else if (filter === 'past') {
    where = { status: { [Op.in]: ['completed', 'cancelled'] } };
  }

  const meetings = await Meeting.findAll({
    where,
    include: [{ model: MeetingMinute, as: 'minutes' }],
    order: [['date', filter === 'past' ? 'DESC' : 'ASC']]
  });

  res.status(200).json({
    status: 'success',
    results: meetings.length,
    data: { meetings }
  });
});

/**
 * Common: Get meeting details with minutes
 */
exports.getMeetingDetails = catchAsync(async (req, res, next) => {
  const meeting = await Meeting.findOne({
    where: { id: req.params.id, ...attachInstitution(req) },
    include: [
        { 
            model: MeetingMinute, 
            as: 'minutes',
            include: [{ model: User, as: 'recorder', attributes: ['name'] }]
        }
    ]
  });

  if (!meeting) return next(new AppError('Meeting not found', 404));

  res.status(200).json({
    status: 'success',
    data: { meeting }
  });
});

/**
 * Admin: Cancel meeting
 */
exports.cancelMeeting = catchAsync(async (req, res, next) => {
  const meeting = await Meeting.findOne({ where: { id: req.params.id, ...attachInstitution(req) } });
  if (!meeting) return next(new AppError('Meeting not found', 404));

  await meeting.update({ status: 'cancelled' });

  res.status(200).json({
    status: 'success',
    data: { meeting }
  });
});
