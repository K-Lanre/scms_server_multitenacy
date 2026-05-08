const { SavingsProduct } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { logAction } = require('../utils/auditLogger');

/**
 * @swagger
 * /api/v1/savings-products:
 *   post:
 *     summary: Create a new savings product
 *     tags: [Savings Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - interestRate
 *               - minDuration
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [fixed, target]
 *               interestRate:
 *                 type: number
 *               minDuration:
 *                 type: integer
 *               maxDuration:
 *                 type: integer
 *               penaltyPercentage:
 *                 type: number
 *               allowEarlyWithdrawal:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Product created successfully
 */
exports.createProduct = catchAsync(async (req, res, next) => {
    const {
        name, description, type, interestRate, minDuration, maxDuration, penaltyPercentage, allowEarlyWithdrawal,
        category, isQuickSaving
    } = req.body;

    // Basic validation
    if (!name || !type || !interestRate || !minDuration) {
        return next(new AppError('Please provide all required fields', 400));
    }

    const product = await SavingsProduct.create({
        name,
        description,
        type,
        interestRate,
        minDuration,
        maxDuration,
        minDeposit,
        penaltyPercentage,
        allowEarlyWithdrawal,
        category: category || 'none',
        isQuickSaving: isQuickSaving || false
    });

    logAction(req, 'SAVINGS_PRODUCT_CREATED', { productId: product.id, name: product.name });

    res.status(201).json({
        status: 'success',
        data: {
            product
        }
    });
});

/**
 * @swagger
 * /api/v1/savings-products:
 *   get:
 *     summary: Get all savings products
 *     tags: [Savings Products]
 *     responses:
 *       200:
 *         description: List of savings products
 */
exports.getAllProducts = catchAsync(async (req, res, next) => {
    const products = await SavingsProduct.findAll({
        where: { status: 'active' }
    });

    res.status(200).json({
        status: 'success',
        results: products.length,
        data: {
            products
        }
    });
});

/**
 * @swagger
 * /api/v1/savings-products/{id}:
 *   get:
 *     summary: Get a single savings product
 *     tags: [Savings Products]
 *     responses:
 *       200:
 *         description: Savings product retrieved successfully
 */
exports.getProduct = catchAsync(async (req, res, next) => {
    const product = await SavingsProduct.findByPk(req.params.id);

    if (!product) {
        return next(new AppError('Savings product not found', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            product
        }
    });
});

/**
 * @swagger
 * /api/v1/savings-products/{id}:
 *   patch:
 *     summary: Update a savings product
 *     tags: [Savings Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               interestRate:
 *                 type: number
 *     responses:
 *       200:
 *         description: Product updated successfully
 */
exports.updateProduct = catchAsync(async (req, res, next) => {
    const product = await SavingsProduct.findByPk(req.params.id);

    if (!product) {
        return next(new AppError('Savings product not found', 404));
    }

    const updatedProduct = await product.update(req.body);

    logAction(req, 'SAVINGS_PRODUCT_UPDATED', { productId: product.id, changes: req.body });

    res.status(200).json({
        status: 'success',
        data: {
            product: updatedProduct
        }
    });
});

/**
 * @swagger
 * /api/v1/savings-products/{id}:
 *   delete:
 *     summary: Delete a savings product
 *     tags: [Savings Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Product deleted successfully
 */
exports.deleteProduct = catchAsync(async (req, res, next) => {
    const product = await SavingsProduct.findByPk(req.params.id);

    if (!product) {
        return next(new AppError('Savings product not found', 404));
    }

    // Soft delete by setting status to inactive
    await product.update({ status: 'inactive' });

    logAction(req, 'SAVINGS_PRODUCT_DELETED', { productId: product.id, name: product.name });

    res.status(204).json({
        status: 'success',
        data: null
    });
});
