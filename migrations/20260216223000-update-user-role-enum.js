'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // No operation – enum already includes 'user' in the base migration
    return Promise.resolve();
  },
  async down(queryInterface, Sequelize) {
    // No operation – cannot revert safely
    return Promise.resolve();
  }
};
