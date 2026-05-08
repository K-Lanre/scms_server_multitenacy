'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create Institutions table
    await queryInterface.createTable('Institutions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      logoUrl: {
        type: Sequelize.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'suspended'),
        defaultValue: 'active'
      },
      settings: {
        type: Sequelize.JSON,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Helper to add column safely
    const addColumnSafely = async (tableName, columnName, options) => {
      const tableDesc = await queryInterface.describeTable(tableName);
      if (!tableDesc[columnName]) {
        await queryInterface.addColumn(tableName, columnName, options);
      }
    };

    // Define column options
    const columnOptions = {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Institutions',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    };

    // 2. Add institutionId to tables
    await addColumnSafely('Users', 'institutionId', columnOptions);
    await addColumnSafely('Accounts', 'institutionId', columnOptions);
    await addColumnSafely('Loans', 'institutionId', columnOptions);
    await addColumnSafely('Transactions', 'institutionId', columnOptions);
    await addColumnSafely('SavingsProducts', 'institutionId', columnOptions);
    await addColumnSafely('Contributions', 'institutionId', columnOptions);
    await addColumnSafely('Meetings', 'institutionId', columnOptions);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove columns
    const tables = ['Users', 'Accounts', 'Loans', 'Transactions', 'SavingsProducts', 'Contributions', 'Meetings'];
    
    for (const table of tables) {
      const tableDesc = await queryInterface.describeTable(table);
      if (tableDesc['institutionId']) {
        await queryInterface.removeColumn(table, 'institutionId');
      }
    }

    // Drop table
    await queryInterface.dropTable('Institutions');
  }
};
