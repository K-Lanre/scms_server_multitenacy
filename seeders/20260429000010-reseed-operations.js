'use strict';

const helpers = require('./utils/seederHelpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('📋 Seeding Operations Data (Contributions, Meetings, Withdrawals, Notifications, Audit Logs)...');

      // Clear existing data in reverse order
      await queryInterface.bulkDelete('AuditLogs', null, { transaction });
      await queryInterface.bulkDelete('Notifications', null, { transaction });
      await queryInterface.bulkDelete('WithdrawalRequests', null, { transaction });
      await queryInterface.bulkDelete('MeetingMinutes', null, { transaction });
      await queryInterface.bulkDelete('Meetings', null, { transaction });
      await queryInterface.bulkDelete('Contributions', null, { transaction });

      const now = new Date();

      // Get members and their institutions
      const [members] = await queryInterface.sequelize.query(
        `SELECT id, institutionId, email FROM Users WHERE role = 'member' ORDER BY id`,
        { transaction }
      );

      // Get admin users
      const [admins] = await queryInterface.sequelize.query(
        `SELECT id, institutionId FROM Users WHERE role IN ('super_admin', 'institution_admin', 'staff') ORDER BY id`,
        { transaction }
      );

      // Get institutions
      const [institutions] = await queryInterface.sequelize.query(
        'SELECT id, code, name FROM Institutions ORDER BY id',
        { transaction }
      );

      // Get accounts for withdrawal requests
      const [accounts] = await queryInterface.sequelize.query(
        `SELECT id, userId, institutionId, balance FROM Accounts WHERE accountType = 'savings'`,
        { transaction }
      );

      // === 1. CONTRIBUTIONS ===
      console.log('   Creating contributions...');
      const contributions = [];
      const currentMonth = helpers.getCurrentMonth();
      const previousMonth = helpers.getPreviousMonth();

      // Get monthly thrift amounts per institution from settings
      const [institutionSettings] = await queryInterface.sequelize.query(
        `SELECT institutionId, value FROM SystemSettings WHERE \`key\` = 'monthlyThriftAmount'`,
        { transaction }
      );

      const thriftAmounts = {};
      institutionSettings.forEach(setting => {
        thriftAmounts[setting.institutionId] = parseInt(setting.value) || 10000;
      });

      members.forEach(member => {
        const thriftAmount = thriftAmounts[member.institutionId] || 10000;

        // Previous month contribution (mostly paid)
        contributions.push({
          userId: member.id,
          institutionId: member.institutionId,
          month: previousMonth,
          amount: thriftAmount,
          status: Math.random() < 0.8 ? 'paid' : 'defaulted',
          type: 'thrift',
          collectionMethod: Math.random() < 0.7 ? 'automatic' : 'cash',
          paidAt: Math.random() < 0.8 ? helpers.getOffsetDate(-helpers.randomAmount(1, 15)) : null,
          transactionId: null,
          createdAt: now,
          updatedAt: now
        });

        // Current month contribution (mostly pending)
        contributions.push({
          userId: member.id,
          institutionId: member.institutionId,
          month: currentMonth,
          amount: thriftAmount,
          status: Math.random() < 0.3 ? 'paid' : 'pending',
          type: 'thrift',
          collectionMethod: null,
          paidAt: Math.random() < 0.3 ? now : null,
          transactionId: null,
          createdAt: now,
          updatedAt: now
        });
      });

      await queryInterface.bulkInsert('Contributions', contributions, { transaction });

      // === 2. MEETINGS ===
      console.log('   Creating meetings...');
      const meetings = [];
      const meetingMinutes = [];

      institutions.forEach(institution => {
        // Create 3-5 meetings per institution
        const meetingCount = helpers.randomAmount(3, 5);

        for (let i = 0; i < meetingCount; i++) {
          const isCompleted = Math.random() < 0.6;
          const meetingDate = helpers.getOffsetDate(isCompleted ? -helpers.randomAmount(1, 60) : helpers.randomAmount(1, 30));

          meetings.push({
            title: helpers.pickRandom([
              'Monthly General Meeting', 'Executive Committee Meeting', 'Emergency Board Meeting',
              'Financial Review Meeting', 'Annual General Meeting', 'Loan Committee Meeting'
            ]),
            institutionId: institution.id,
            description: `Quarterly review of cooperative activities and financial performance for ${institution.name}`,
            type: helpers.pickRandom(['general', 'executive', 'emergency', 'other']),
            date: meetingDate.toISOString().slice(0, 10),
            time: helpers.pickRandom(['09:00', '10:00', '14:00', '16:00']),
            location: helpers.pickRandom(['Main Hall', 'Conference Room A', 'Virtual (Zoom)', 'Community Center']),
            status: isCompleted ? 'completed' : 'scheduled',
            createdAt: now,
            updatedAt: now
          });

          // Add minutes for completed meetings
          if (isCompleted) {
            meetingMinutes.push({
              meetingId: meetings.length, // Sequential reference
              content: `Meeting convened at ${meetings[meetings.length - 1].time}. Attendees reviewed financial reports, approved ${helpers.randomAmount(3, 8)} loan applications, and discussed upcoming cooperative initiatives. Budget for next quarter was approved unanimously.`,
              attendanceCount: helpers.randomAmount(8, 25),
              recordedBy: admins.find(a => a.institutionId === institution.id || !a.institutionId)?.id || 1,
              createdAt: now,
              updatedAt: now
            });
          }
        }
      });

      await queryInterface.bulkInsert('Meetings', meetings, { transaction });

      // Get actual meeting IDs for minutes
      const [insertedMeetings] = await queryInterface.sequelize.query(
        'SELECT id FROM Meetings WHERE status = "completed" ORDER BY id',
        { transaction }
      );

      // Update meeting minutes with actual IDs
      meetingMinutes.forEach((minute, index) => {
        if (insertedMeetings[index]) {
          minute.meetingId = insertedMeetings[index].id;
        }
      });

      if (meetingMinutes.length > 0) {
        await queryInterface.bulkInsert('MeetingMinutes', meetingMinutes, { transaction });
      }

      // === 3. WITHDRAWAL REQUESTS ===
      console.log('   Creating withdrawal requests...');
      const withdrawalRequests = [];

      // Create withdrawal requests for 30% of accounts
      accounts.filter(() => Math.random() < 0.3).forEach(account => {
        const balance = parseFloat(account.balance);
        if (balance < 10000) return;

        const amount = helpers.randomAmount(5000, Math.min(50000, balance * 0.5));
        const status = helpers.pickRandom(['pending', 'approved', 'rejected', 'pending', 'approved']); // weighted

        const processor = status !== 'pending' ? helpers.pickRandom(admins).id : null;

        withdrawalRequests.push({
          userId: account.userId,
          accountId: account.id,
          amount: amount,
          status: status,
          reason: helpers.pickRandom(['Emergency medical expenses', 'School fees payment', 'Business investment', 'Family support', 'Travel expenses']),
          rejectionReason: status === 'rejected' ? 'Insufficient account balance after withdrawal' : null,
          processedBy: processor,
          processedAt: status !== 'pending' ? helpers.getOffsetDate(-helpers.randomAmount(1, 14)) : null,
          paystackTransferReference: status === 'approved' ? helpers.generateTransferReference() : null,
          recipientName: 'Account Holder',
          recipientAccount: helpers.generateNuban(),
          recipientBank: helpers.getRandomBank(),
          isExternalTransfer: Math.random() < 0.7,
          institutionId: account.institutionId,
          createdAt: helpers.getOffsetDate(-helpers.randomAmount(1, 30)),
          updatedAt: now
        });
      });

      await queryInterface.bulkInsert('WithdrawalRequests', withdrawalRequests, { transaction });

      // === 4. NOTIFICATIONS ===
      console.log('   Creating notifications...');
      const notifications = [];

      members.forEach(member => {
        // Create 2-5 notifications per member
        const notificationCount = helpers.randomAmount(2, 5);

        for (let i = 0; i < notificationCount; i++) {
          const isRead = Math.random() < 0.6;

          notifications.push({
            userId: member.id,
            title: helpers.pickRandom([
              'Monthly Contribution Due', 'Loan Application Update', 'Interest Credited',
              'Meeting Reminder', 'Savings Goal Reached', 'Withdrawal Processed', 'New Feature Available'
            ]),
            message: helpers.pickRandom([
              'Your monthly thrift contribution is due. Please ensure sufficient balance.',
              'Your loan application has been reviewed. Check your dashboard for details.',
              'Interest has been credited to your savings account.',
              'Upcoming cooperative meeting scheduled. Your attendance is appreciated.',
              'Congratulations! You are 80% towards your savings goal.',
              'Your withdrawal request has been processed successfully.',
              'New mobile app features are now available. Update your app to explore.'
            ]),
            type: helpers.pickRandom(['info', 'success', 'warning', 'error']),
            link: helpers.pickRandom(['/dashboard', '/loans', '/savings', '/meetings', null]),
            isRead: isRead,
            readAt: isRead ? helpers.getOffsetDate(-helpers.randomAmount(1, 14)) : null,
            institutionId: member.institutionId,
            createdAt: helpers.getOffsetDate(-helpers.randomAmount(1, 30)),
            updatedAt: now
          });
        }
      });

      await queryInterface.bulkInsert('Notifications', notifications, { transaction });

      // === 5. AUDIT LOGS ===
      console.log('   Creating audit logs...');
      const auditLogs = [];

      // Create audit logs for admin activities
      const actions = [
        'USER_APPROVED', 'LOAN_APPROVED', 'WITHDRAWAL_PROCESSED', 'SETTING_UPDATED',
        'MEETING_CREATED', 'TRANSACTION_RECORDED', 'REPORT_GENERATED', 'LOGIN'
      ];

      for (let i = 0; i < 100; i++) {
        const admin = helpers.pickRandom(admins);
        const action = helpers.pickRandom(actions);

        auditLogs.push({
          userId: admin.id,
          action: action,
          details: JSON.stringify({
            description: `Admin performed ${action}`,
            timestamp: now.toISOString(),
            affectedEntity: helpers.pickRandom(['User', 'Loan', 'Transaction', 'Setting', 'Meeting'])
          }),
          ipAddress: `192.168.${helpers.randomAmount(1, 255)}.${helpers.randomAmount(1, 255)}`,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          createdAt: helpers.getOffsetDate(-helpers.randomAmount(1, 90))
        });
      }

      await queryInterface.bulkInsert('AuditLogs', auditLogs, { transaction });

      await transaction.commit();
      console.log(`✅ Operations data created:`);
      console.log(`   - ${contributions.length} contributions (thrift records)`);
      console.log(`   - ${meetings.length} meetings with ${meetingMinutes.length} minutes`);
      console.log(`   - ${withdrawalRequests.length} withdrawal requests`);
      console.log(`   - ${notifications.length} notifications`);
      console.log(`   - ${auditLogs.length} audit log entries`);

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error seeding operations data:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Removing seeded operations data...');
    await queryInterface.bulkDelete('AuditLogs', null, {});
    await queryInterface.bulkDelete('Notifications', null, {});
    await queryInterface.bulkDelete('WithdrawalRequests', null, {});
    await queryInterface.bulkDelete('MeetingMinutes', null, {});
    await queryInterface.bulkDelete('Meetings', null, {});
    await queryInterface.bulkDelete('Contributions', null, {});
  }
};
