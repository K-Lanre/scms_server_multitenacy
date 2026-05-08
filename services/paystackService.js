const fetch = global.fetch || require('node-fetch'); // Fallback for older node if needed, but 22+ has it

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

/**
 * Service to handle Paystack integrations
 */
class PaystackService {
    /**
     * Get headers for Paystack requests
     */
    static getHeaders() {
        return {
            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Create a customer on Paystack
     * @param {Object} user - User model instance
     */
    static async createCustomer(user) {
        if (!PAYSTACK_SECRET_KEY || !PAYSTACK_SECRET_KEY.startsWith('sk_')) {
            console.warn('Paystack Secret Key missing or invalid format. Using mock customer.');
            return { customer_code: `mock_cust_${user.id}` };
        }

        const response = await fetch(`${PAYSTACK_BASE_URL}/customer`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                email: user.email,
                first_name: user.name.split(' ')[0],
                last_name: user.name.split(' ').slice(1).join(' ') || 'User',
                phone: user.phoneNumber
            })
        });

        const result = await response.json();
        if (!result.status) {
            throw new Error(`Paystack Customer Creation Error: ${result.message}`);
        }

        return result.data;
    }

    /**
     * Assign a dedicated virtual account to a customer
     * @param {string} customerCode - Paystack customer code
     * @param {string} preferredBank - Optional preferred bank (e.g. 'wema-bank')
     */
    static async assignDedicatedAccount(customerCode, preferredBank = 'wema-bank') {
        if (!PAYSTACK_SECRET_KEY || !PAYSTACK_SECRET_KEY.startsWith('sk_')) {
            console.warn('Paystack Secret Key missing or invalid format. Using mock DVA.');
            return {
                bank: { name: 'Mock Bank' },
                account_number: `00${Math.floor(Math.random() * 100000000)}`,
                account_name: 'Mock Virtual Account'
            };
        }

        const response = await fetch(`${PAYSTACK_BASE_URL}/dedicated_account`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                customer: customerCode,
                preferred_bank: preferredBank
            })
        });

        const result = await response.json();
        if (!result.status) {
            throw new Error(`Paystack DVA Assignment Error: ${result.message}`);
        }

        return result.data;
    }

    /**
     * Resolve account number to verify details
     * @param {string} accountNumber - Bank account number
     * @param {string} bankCode - Bank code
     */
    static async resolveAccount(accountNumber, bankCode) {
        if (!PAYSTACK_SECRET_KEY || !PAYSTACK_SECRET_KEY.startsWith('sk_')) {
            console.warn('Paystack Secret Key missing or invalid format. Using mock Resolve Account.');
            return {
                account_number: accountNumber,
                account_name: 'Mock Account Name',
                bank_id: 1
            };
        }

        const response = await fetch(`${PAYSTACK_BASE_URL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
            method: 'GET',
            headers: this.getHeaders()
        });

        const result = await response.json();
        if (!result.status) {
            throw new Error(`Paystack Resolve Account Error: ${result.message}`);
        }

        return result.data;
    }

    /**
     * Create a transfer recipient
     * @param {string} name - Account holder name
     * @param {string} accountNumber - Account number
     * @param {string} bankCode - Bank code
     */
    static async createTransferRecipient(name, accountNumber, bankCode) {
        if (!PAYSTACK_SECRET_KEY || !PAYSTACK_SECRET_KEY.startsWith('sk_')) {
            console.warn('Paystack Secret Key missing or invalid format. Using mock Transfer Recipient.');
            return {
                recipient_code: `RCP_mock_${Math.floor(Math.random() * 1000000)}`,
                active: true,
                details: {
                    account_number: accountNumber,
                    account_name: name,
                    bank_code: bankCode,
                    bank_name: 'Mock Bank'
                }
            };
        }

        const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                type: 'nuban',
                name,
                account_number: accountNumber,
                bank_code: bankCode,
                currency: 'NGN'
            })
        });

        const result = await response.json();
        if (!result.status) {
            throw new Error(`Paystack Create Recipient Error: ${result.message}`);
        }

        return result.data;
    }

    /**
     * Initiate a transfer
     * @param {number} amount - Amount in kobo
     * @param {string} recipientCode - Paystack recipient code
     * @param {string} reason - Reason for transfer
     */
    static async initiateTransfer(amount, recipientCode, reason) {
        if (!PAYSTACK_SECRET_KEY || !PAYSTACK_SECRET_KEY.startsWith('sk_')) {
            console.warn('Paystack Secret Key missing or invalid format. Using mock Transfer.');
            return {
                reference: `TRF_mock_${Date.now()}`,
                status: 'success', // or 'pending' typically
                amount,
                transfer_code: `TRF_${Math.floor(Math.random() * 1000000)}`
            };
        }

        const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                source: 'balance',
                amount,
                recipient: recipientCode,
                reason
            })
        });

        const result = await response.json();
        if (!result.status) {
            throw new Error(`Paystack Initiate Transfer Error: ${result.message}`);
        }

        return result.data;
    }
}

module.exports = PaystackService;
