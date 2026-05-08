'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Fix SystemSettings table
    console.log('Fixing SystemSettings unique constraint...');
    try {
      await queryInterface.removeConstraint('SystemSettings', 'SystemSettings_key_unique');
    } catch (e) {
      console.log('Note: SystemSettings_key_unique constraint may not exist');
    }

    try {
      await queryInterface.addColumn('SystemSettings', 'institutionId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Institutions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    } catch (e) {
      console.log('Note: institutionId column may already exist in SystemSettings');
    }

    await queryInterface.addIndex('SystemSettings', ['key', 'institutionId'], {
      unique: true,
      name: 'system_settings_key_institution_unique'
    });

    // Fix SavingsProducts table
    console.log('Fixing SavingsProducts unique constraint...');
    try {
      await queryInterface.removeConstraint('SavingsProducts', 'SavingsProducts_name_unique');
    } catch (e) {
      console.log('Note: SavingsProducts_name_unique constraint may not exist');
    }

    try {
      await queryInterface.addColumn('SavingsProducts', 'institutionId', {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Institutions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    } catch (e) {
      console.log('Note: institutionId column may already exist in SavingsProducts');
    }

    await queryInterface.addIndex('SavingsProducts', ['name', 'institutionId'], {
      unique: true,
      name: 'savings_products_name_institution_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert SystemSettings
    await queryInterface.removeIndex('SystemSettings', 'system_settings_key_institution_unique');
    await queryInterface.addConstraint('SystemSettings', {
      fields: ['key'],
      type: 'unique',
      name: 'SystemSettings_key_unique'
    });

    // Revert SavingsProducts
    await queryInterface.removeIndex('SavingsProducts', 'savings_products_name_institution_unique');
    await queryInterface.addConstraint('SavingsProducts', {
      fields: ['name'],
      type: 'unique',
      name: 'SavingsProducts_name_unique'
    });
  }
};
