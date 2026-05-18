/**
 * Loan calculation utilities
 */

/**
 * Calculate monthly repayment schedule
 * @param {number} loanAmount - Principal loan amount
 * @param {number} annualInterestRate - Annual interest rate (percentage)
 * @param {number} monthlyPayment - Fixed monthly payment amount
 * @returns {Object} - {months, totalInterest, schedule: []}
 */
exports.calculateMonthlySchedule = (loanAmount, annualInterestRate, monthlyPayment) => {
    const principal = parseFloat(loanAmount);
    const monthlyRate = parseFloat(annualInterestRate) / 100 / 12;
    let balance = principal;
    const schedule = [];
    let month = 0;
    let totalInterest = 0;

    while (balance > 0 && month < 360) { // Max 30 years
        month++;
        const interestForMonth = balance * monthlyRate;
        const principalPayment = Math.min(monthlyPayment - interestForMonth, balance);

        if (principalPayment <= 0) {
            throw new Error('Monthly payment is too small to cover interest');
        }

        balance -= principalPayment;
        totalInterest += interestForMonth;

        schedule.push({
            month,
            payment: monthlyPayment,
            principal: principalPayment,
            interest: interestForMonth,
            balance: Math.max(0, balance)
        });

        if (balance < 0.01) break; // Rounding protection
    }

    return {
        months: month,
        totalInterest: Math.ceil(totalInterest),
        totalRepayable: Math.ceil(principal + totalInterest),
        schedule
    };
};

/**
 * Calculate minimum monthly payment
 * @param {number} loanAmount - Principal loan amount  
 * @param {number} annualInterestRate - Annual interest rate (percentage)
 * @param {number} maxMonths - Maximum duration in months
 * @returns {number} - Minimum monthly payment
 */
exports.calculateMinimumPayment = (loanAmount, annualInterestRate, maxMonths) => {
    const principal = parseFloat(loanAmount);
    const monthlyRate = parseFloat(annualInterestRate) / 100 / 12;
    const months = parseInt(maxMonths);

    if (monthlyRate === 0) {
        return principal / months;
    }

    // Using amortization formula: P * [r(1+r)^n] / [(1+r)^n - 1]
    const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, months);
    const denominator = Math.pow(1 + monthlyRate, months) - 1;

    return Math.ceil(numerator / denominator);
};

/**
 * Calculate due date based on loan duration
 * @param {Date} disbursementDate - Date loan was disbursed
 * @param {number} durationMonths - Loan duration in months
 * @returns {Date} - Due date
 */
exports.calculateDueDate = (disbursementDate, durationMonths) => {
    const dueDate = new Date(disbursementDate);
    dueDate.setMonth(dueDate.getMonth() + parseInt(durationMonths));
    return dueDate;
};

/**
 * Calculate extension interest for defaulted loan
 * @param {number} outstandingBalance - Current outstanding balance
 * @param {number} annualInterestRate - Annual interest rate (%

)
 * @param {number} extensionMonths - Extension period in months (default 2)
 * @returns {number} - Additional interest to be added
 */
exports.calculateExtensionInterest = (outstandingBalance, annualInterestRate, extensionMonths = 2) => {
    const balance = parseFloat(outstandingBalance);
    const rate = parseFloat(annualInterestRate) / 100;
    const months = parseInt(extensionMonths);

    // Simple interest for extension period
    const interest = balance * rate * (months / 12);
    return Math.ceil(interest);
};
