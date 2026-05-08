const { User, Loan, Transaction, SavingsProduct, Account } = require('../models');
const { Op } = require('sequelize');
const catchAsync = require('../utils/catchAsync');
const { attachInstitution } = require('../middleware/tenantMiddleware');

exports.globalSearch = catchAsync(async (req, res, next) => {
    const { q } = req.query;
    const { role } = req.user;
    const where = attachInstitution(req);

    if (!q || q.length < 2) {
        return res.status(200).json({
            status: 'success',
            data: { results: [] }
        });
    }

    const results = [];

    // 1. Members / Users (Admin/Staff only)
    if (['institution_admin', 'staff', 'super_admin'].includes(role)) {
        const users = await User.findAll({
            where: {
                ...where,
                status: 'active',
                [Op.or]: [
                    { name: { [Op.like]: `%${q}%` } },
                    { email: { [Op.like]: `%${q}%` } }
                ]
            },
            attributes: ['id', 'name', 'email'],
            limit: 5
        });

        users.forEach(u => {
            results.push({
                id: `user-${u.id}`,
                title: u.name,
                subtitle: u.email,
                type: 'Member',
                path: `/admin/users`, // Redirect to list
                icon: 'User'
            });
        });
    }

    // 2. Loans (Admin/Staff only)
    if (['institution_admin', 'staff'].includes(role)) {
        const loans = await Loan.findAll({
            where: {
                ...where,
                [Op.or]: [
                    { id: { [Op.like]: `%${q}%` } },
                    { loanType: { [Op.like]: `%${q}%` } },
                    { loanPurpose: { [Op.like]: `%${q}%` } }
                ]
            },
            include: [{ model: User, as: 'borrower', attributes: ['name'] }],
            limit: 5
        });

        loans.forEach(l => {
            results.push({
                id: `loan-${l.id}`,
                title: `Loan #${l.id} - ${l.borrower?.name || 'Unknown'}`,
                subtitle: `₦${parseFloat(l.loanAmount).toLocaleString()} (${l.status})`,
                type: 'Loan',
                path: `/admin/loan-portfolio`,
                icon: 'FileText'
            });
        });
    }

    // 3. Savings Products (Admin/Staff only)
    if (['institution_admin', 'staff'].includes(role)) {
        const products = await SavingsProduct.findAll({
            where: {
                ...where,
                name: { [Op.like]: `%${q}%` }
            },
            limit: 3
        });

        products.forEach(p => {
            results.push({
                id: `product-${p.id}`,
                title: p.name,
                subtitle: `${p.type} - ${p.interestRate}% Interest`,
                type: 'Product',
                path: `/admin/savings-products`,
                icon: 'Folder'
            });
        });
    }

    res.status(200).json({
        status: 'success',
        data: { results }
    });
});
