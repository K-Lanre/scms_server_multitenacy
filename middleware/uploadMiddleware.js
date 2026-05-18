const multer = require('multer');
const AppError = require('../utils/appError');
const fs = require('fs');
const path = require('path');

// Ensure upload directory exists
const uploadDir = 'public/img/users';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const institutionUploadDir = 'public/img/institutions';
if (!fs.existsSync(institutionUploadDir)) {
    fs.mkdirSync(institutionUploadDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img/users');
    },
    filename: (req, file, cb) => {
        try {
            if (!req.user || !req.user.id) {
                console.error('MULTER ERROR: req.user or req.user.id is missing!');
                return cb(new AppError('Authentication failed during file upload', 401));
            }
            // user-{id}-{timestamp}.jpeg
            const ext = file.mimetype.split('/')[1];
            const filename = `user-${req.user.id}-${Date.now()}.${ext}`;
            console.log('MULTER: Generated filename:', filename);
            cb(null, filename);
        } catch (err) {
            console.error('MULTER FILENAME ERROR:', err);
            cb(err);
        }
    }
});

const multerFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new AppError('Invalid file type! Please upload only images or PDFs.', 400), false);
    }
};

const upload = multer({
    storage: multerStorage,
    fileFilter: multerFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB max for user photos/docs
});

exports.uploadOnboardingImages = upload.fields([
    { name: 'idImage', maxCount: 1 },
    { name: 'profilePicture', maxCount: 1 }
]);

exports.uploadProfileAndDocs = upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'addressProof', maxCount: 1 }
]);

exports.uploadProfilePicture = upload.single('profilePicture');

const institutionStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img/institutions');
    },
    filename: (req, file, cb) => {
        try {
            const ext = file.mimetype.split('/')[1];
            const institutionId = req.institutionId || (req.params.id && req.user.role === 'super_admin' ? req.params.id : 'unknown');
            const filename = `institution-${institutionId}-${Date.now()}.${ext}`;
            cb(null, filename);
        } catch (err) {
            cb(err);
        }
    }
});

const uploadInstitution = multer({
    storage: institutionStorage,
    fileFilter: multerFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB max for institution logos
});

exports.uploadInstitutionLogo = uploadInstitution.single('logoUrl');
