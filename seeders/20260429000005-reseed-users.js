'use strict';

const bcrypt = require('bcryptjs');
const helpers = require('./utils/seederHelpers');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('👤 Seeding Users...');
      
      // Clear existing users (except we want fresh start)
      await queryInterface.bulkDelete('Users', null, { transaction });
      
      const now = new Date();
      const defaultPassword = await bcrypt.hash('Password123!', 12);
      
      // Get institution IDs
      const [institutions] = await queryInterface.sequelize.query(
        'SELECT id, code FROM Institutions WHERE code IN ("COOP001", "UTS002", "MCU003")',
        { transaction }
      );
      
      const institutionMap = {};
      institutions.forEach(inst => {
        institutionMap[inst.code] = inst.id;
      });
      
      // Base user templates
      const users = [];
      
      // === SUPER ADMIN (Global, institutionId = null) ===
      users.push({
        name: 'System Administrator',
        email: 'superadmin@scms.com',
        password: defaultPassword,
        role: 'super_admin',
        status: 'active',
        isEmailVerified: true,
        phoneNumber: helpers.generatePhoneNumber(),
        idType: 'national_id',
        idNumber: helpers.generateIdNumber('SA'),
        dateOfBirth: '1980-01-15',
        gender: 'male',
        maritalStatus: 'married',
        membershipType: null,
        institutionId: null, // Super admin is global
        paystackCustomerCode: helpers.generatePaystackCustomerCode(),
        bankName: helpers.getRandomBank(),
        bankCode: '035',
        accountNumber: helpers.generateNuban(),
        paystackRecipientCode: helpers.generatePaystackRecipientCode(),
        createdAt: now,
        updatedAt: now
      });
      
      // === COOP001 Users ===
      const coop001Id = institutionMap.COOP001;
      if (coop001Id) {
        // Institution Admin
        users.push({
          name: 'Adebayo Johnson',
          email: 'admin@coop001.com',
          password: defaultPassword,
          role: 'institution_admin',
          status: 'active',
          isEmailVerified: true,
          phoneNumber: helpers.generatePhoneNumber(),
          idType: 'national_id',
          idNumber: helpers.generateIdNumber('AD'),
          dateOfBirth: '1975-03-20',
          gender: 'male',
          maritalStatus: 'married',
          membershipType: 'REGULAR',
          institutionId: coop001Id,
          paystackCustomerCode: helpers.generatePaystackCustomerCode(),
          bankName: helpers.getRandomBank(),
          bankCode: '035',
          accountNumber: helpers.generateNuban(),
          paystackRecipientCode: helpers.generatePaystackRecipientCode(),
          createdAt: now,
          updatedAt: now
        });
        
        // Staff
        users.push({
          name: 'Grace Okafor',
          email: 'staff1@coop001.com',
          password: defaultPassword,
          role: 'staff',
          status: 'active',
          isEmailVerified: true,
          phoneNumber: helpers.generatePhoneNumber(),
          idType: 'voters_card',
          idNumber: helpers.generateIdNumber('ST'),
          dateOfBirth: '1988-07-12',
          gender: 'female',
          maritalStatus: 'single',
          membershipType: 'REGULAR',
          institutionId: coop001Id,
          paystackCustomerCode: helpers.generatePaystackCustomerCode(),
          bankName: helpers.getRandomBank(),
          bankCode: '035',
          accountNumber: helpers.generateNuban(),
          paystackRecipientCode: helpers.generatePaystackRecipientCode(),
          createdAt: now,
          updatedAt: now
        });
        
        // Members (12 members)
        const coopMembers = [
          { name: 'Emmanuel Chukwu', email: 'emmanuel.c@coop001.com', gender: 'male', dob: '1990-05-15' },
          { name: 'Folake Adeyemi', email: 'folake.a@coop001.com', gender: 'female', dob: '1985-11-22' },
          { name: 'Ibrahim Suleiman', email: 'ibrahim.s@coop001.com', gender: 'male', dob: '1982-09-08' },
          { name: 'Chioma Eze', email: 'chioma.e@coop001.com', gender: 'female', dob: '1992-02-28' },
          { name: 'Olumide Balogun', email: 'olumide.b@coop001.com', gender: 'male', dob: '1987-06-18' },
          { name: 'Ngozi Nwosu', email: 'ngozi.n@coop001.com', gender: 'female', dob: '1991-12-03' },
          { name: 'Peter Johnson', email: 'peter.j@coop001.com', gender: 'male', dob: '1989-04-25' },
          { name: 'Amina Mohammed', email: 'amina.m@coop001.com', gender: 'female', dob: '1993-08-14' },
          { name: 'Samuel Ige', email: 'samuel.i@coop001.com', gender: 'male', dob: '1984-01-30' },
          { name: 'Precious Udo', email: 'precious.u@coop001.com', gender: 'female', dob: '1995-07-07' },
          { name: 'Yusuf Lawal', email: 'yusuf.l@coop001.com', gender: 'male', dob: '1986-10-19' },
          { name: 'Chidinma Kalu', email: 'chidinma.k@coop001.com', gender: 'female', dob: '1994-03-11' }
        ];
        
        coopMembers.forEach(member => {
          users.push({
            name: member.name,
            email: member.email,
            password: defaultPassword,
            role: 'member',
            status: 'active',
            isEmailVerified: true,
            phoneNumber: helpers.generatePhoneNumber(),
            idType: 'national_id',
            idNumber: helpers.generateIdNumber('MEM'),
            dateOfBirth: member.dob,
            gender: member.gender,
            maritalStatus: helpers.pickRandom(['single', 'married']),
            membershipType: 'REGULAR',
            institutionId: coop001Id,
            paystackCustomerCode: helpers.generatePaystackCustomerCode(),
            bankName: helpers.getRandomBank(),
            bankCode: '035',
            accountNumber: helpers.generateNuban(),
            paystackRecipientCode: helpers.generatePaystackRecipientCode(),
            createdAt: now,
            updatedAt: now
          });
        });
      }
      
      // === UTS002 Users ===
      const uts002Id = institutionMap.UTS002;
      if (uts002Id) {
        // Institution Admin
        users.push({
          name: 'Nnamdi Obi',
          email: 'admin@uts002.com',
          password: defaultPassword,
          role: 'institution_admin',
          status: 'active',
          isEmailVerified: true,
          phoneNumber: helpers.generatePhoneNumber(),
          idType: 'drivers_license',
          idNumber: helpers.generateIdNumber('AD'),
          dateOfBirth: '1978-11-05',
          gender: 'male',
          maritalStatus: 'married',
          membershipType: 'REGULAR',
          institutionId: uts002Id,
          paystackCustomerCode: helpers.generatePaystackCustomerCode(),
          bankName: helpers.getRandomBank(),
          bankCode: '035',
          accountNumber: helpers.generateNuban(),
          paystackRecipientCode: helpers.generatePaystackRecipientCode(),
          createdAt: now,
          updatedAt: now
        });
        
        // Staff
        users.push({
          name: 'Temitope Akintola',
          email: 'staff1@uts002.com',
          password: defaultPassword,
          role: 'staff',
          status: 'active',
          isEmailVerified: true,
          phoneNumber: helpers.generatePhoneNumber(),
          idType: 'national_id',
          idNumber: helpers.generateIdNumber('ST'),
          dateOfBirth: '1990-04-17',
          gender: 'female',
          maritalStatus: 'single',
          membershipType: 'REGULAR',
          institutionId: uts002Id,
          paystackCustomerCode: helpers.generatePaystackCustomerCode(),
          bankName: helpers.getRandomBank(),
          bankCode: '035',
          accountNumber: helpers.generateNuban(),
          paystackRecipientCode: helpers.generatePaystackRecipientCode(),
          createdAt: now,
          updatedAt: now
        });
        
        users.push({
          name: 'Gbenga Ajayi',
          email: 'staff2@uts002.com',
          password: defaultPassword,
          role: 'staff',
          status: 'active',
          isEmailVerified: true,
          phoneNumber: helpers.generatePhoneNumber(),
          idType: 'voters_card',
          idNumber: helpers.generateIdNumber('ST'),
          dateOfBirth: '1987-12-09',
          gender: 'male',
          maritalStatus: 'married',
          membershipType: 'REGULAR',
          institutionId: uts002Id,
          paystackCustomerCode: helpers.generatePaystackCustomerCode(),
          bankName: helpers.getRandomBank(),
          bankCode: '035',
          accountNumber: helpers.generateNuban(),
          paystackRecipientCode: helpers.generatePaystackRecipientCode(),
          createdAt: now,
          updatedAt: now
        });
        
        // Members (10 members)
        const utsMembers = [
          { name: 'Ifeanyi Onwumere', email: 'ifeanyi.o@uts002.com', gender: 'male', dob: '1985-06-22' },
          { name: 'Funmilayo Fashola', email: 'funmilayo.f@uts002.com', gender: 'female', dob: '1983-09-14' },
          { name: 'Emeka Okeke', email: 'emeka.o@uts002.com', gender: 'male', dob: '1991-01-08' },
          { name: 'Kemi Olusegun', email: 'kemi.o@uts002.com', gender: 'female', dob: '1989-05-30' },
          { name: 'Uche Akande', email: 'uche.a@uts002.com', gender: 'male', dob: '1986-11-17' },
          { name: 'Rashidat Ibrahim', email: 'rashidat.i@uts002.com', gender: 'female', dob: '1992-07-04' },
          { name: 'Kunle Olatunji', email: 'kunle.o@uts002.com', gender: 'male', dob: '1984-03-26' },
          { name: 'Zainab Yakubu', email: 'zainab.y@uts002.com', gender: 'female', dob: '1993-10-12' },
          { name: 'Michael Chidi', email: 'michael.c@uts002.com', gender: 'male', dob: '1988-08-19' },
          { name: 'Adewale Osinbajo', email: 'adewale.o@uts002.com', gender: 'male', dob: '1982-02-03' }
        ];
        
        utsMembers.forEach(member => {
          users.push({
            name: member.name,
            email: member.email,
            password: defaultPassword,
            role: 'member',
            status: 'active',
            isEmailVerified: true,
            phoneNumber: helpers.generatePhoneNumber(),
            idType: 'national_id',
            idNumber: helpers.generateIdNumber('MEM'),
            dateOfBirth: member.dob,
            gender: member.gender,
            maritalStatus: helpers.pickRandom(['single', 'married']),
            membershipType: 'REGULAR',
            institutionId: uts002Id,
            paystackCustomerCode: helpers.generatePaystackCustomerCode(),
            bankName: helpers.getRandomBank(),
            bankCode: '035',
            accountNumber: helpers.generateNuban(),
            paystackRecipientCode: helpers.generatePaystackRecipientCode(),
            createdAt: now,
            updatedAt: now
          });
        });
      }
      
      // === MCU003 Users ===
      const mcu003Id = institutionMap.MCU003;
      if (mcu003Id) {
        // Institution Admin
        users.push({
          name: 'Babatunde Lawal',
          email: 'admin@mcu003.com',
          password: defaultPassword,
          role: 'institution_admin',
          status: 'active',
          isEmailVerified: true,
          phoneNumber: helpers.generatePhoneNumber(),
          idType: 'international_passport',
          idNumber: helpers.generateIdNumber('AD'),
          dateOfBirth: '1972-08-28',
          gender: 'male',
          maritalStatus: 'married',
          membershipType: 'REGULAR',
          institutionId: mcu003Id,
          paystackCustomerCode: helpers.generatePaystackCustomerCode(),
          bankName: helpers.getRandomBank(),
          bankCode: '035',
          accountNumber: helpers.generateNuban(),
          paystackRecipientCode: helpers.generatePaystackRecipientCode(),
          createdAt: now,
          updatedAt: now
        });
        
        // Staff
        users.push({
          name: 'Seyi Mohammed',
          email: 'staff1@mcu003.com',
          password: defaultPassword,
          role: 'staff',
          status: 'active',
          isEmailVerified: true,
          phoneNumber: helpers.generatePhoneNumber(),
          idType: 'national_id',
          idNumber: helpers.generateIdNumber('ST'),
          dateOfBirth: '1995-06-15',
          gender: 'female',
          maritalStatus: 'single',
          membershipType: 'REGULAR',
          institutionId: mcu003Id,
          paystackCustomerCode: helpers.generatePaystackCustomerCode(),
          bankName: helpers.getRandomBank(),
          bankCode: '035',
          accountNumber: helpers.generateNuban(),
          paystackRecipientCode: helpers.generatePaystackRecipientCode(),
          createdAt: now,
          updatedAt: now
        });
        
        // Members (8 members)
        const mcuMembers = [
          { name: 'Ayodeji Salisu', email: 'ayodeji.s@mcu003.com', gender: 'male', dob: '1990-09-20' },
          { name: 'Adeola Umaru', email: 'adeola.u@mcu003.com', gender: 'female', dob: '1987-04-11' },
          { name: 'Bamidele Ogunleye', email: 'bamidele.o@mcu003.com', gender: 'male', dob: '1983-12-05' },
          { name: 'Akinola Ige', email: 'akinola.i@mcu003.com', gender: 'male', dob: '1992-08-23' },
          { name: 'Akinwale Kalu', email: 'akinwale.k@mcu003.com', gender: 'male', dob: '1989-01-14' },
          { name: 'Adewale Johnson', email: 'adewale.j@mcu003.com', gender: 'male', dob: '1985-07-29' },
          { name: 'Adeyemi Okonkwo', email: 'adeyemi.o@mcu003.com', gender: 'male', dob: '1991-03-07' },
          { name: 'Ayodele Musa', email: 'ayodele.m@mcu003.com', gender: 'male', dob: '1986-10-31' }
        ];
        
        mcuMembers.forEach(member => {
          users.push({
            name: member.name,
            email: member.email,
            password: defaultPassword,
            role: 'member',
            status: 'active',
            isEmailVerified: true,
            phoneNumber: helpers.generatePhoneNumber(),
            idType: 'national_id',
            idNumber: helpers.generateIdNumber('MEM'),
            dateOfBirth: member.dob,
            gender: member.gender,
            maritalStatus: helpers.pickRandom(['single', 'married']),
            membershipType: 'REGULAR',
            institutionId: mcu003Id,
            paystackCustomerCode: helpers.generatePaystackCustomerCode(),
            bankName: helpers.getRandomBank(),
            bankCode: '035',
            accountNumber: helpers.generateNuban(),
            paystackRecipientCode: helpers.generatePaystackRecipientCode(),
            createdAt: now,
            updatedAt: now
          });
        });
      }
      
      await queryInterface.bulkInsert('Users', users, { transaction });
      
      await transaction.commit();
      console.log(`✅ Created ${users.length} users across 3 institutions`);
      console.log('   - 1 Super Admin');
      console.log('   - 3 Institution Admins');
      console.log('   - 4 Staff members');
      console.log(`   - ${users.length - 8} Regular members`);
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error seeding users:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️  Removing seeded users...');
    await queryInterface.bulkDelete('Users', null, {});
  }
};
