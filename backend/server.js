// Import Packages
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;


// Middleware
// Allow requests from the Good Business frontend
app.use(cors({
    origin: process.env.FRONTEND_ORIGIN
}));

// Allow the server to read JSON submissions
app.use(express.json({ limit: '10kb' }));


// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(function () {
        console.log('Connected to Good Business MongoDB');
    })
    .catch(function (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    });


// Business Suggestion Schema
// Defines what information is saved for each submission
const suggestionSchema = new mongoose.Schema({

    businessName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },

    location: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },

    website: {
        type: String,
        default: ''
    },

    reason: {
        type: String,
        default: '',
        maxlength: 2000
    },

    categories: {
        type: [String],
        default: []
    },

    status: {
        type: String,
        default: 'Pending verification',
        enum: [
            'Pending verification',
            'Needs more information',
            'Verified',
            'Rejected'
        ]
    },

    submittedAt: {
        type: Date,
        default: Date.now
    }

}, {
    collection: 'suggestions'
});


// Create the Suggestion Model
const Suggestion = mongoose.model('Suggestion', suggestionSchema);


// Limit Repeated Submissions
const submissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        message: 'Too many submissions. Please try again later.'
    }
});


// Allowed Categories
const allowedCategories = [
    'Sustainability',
    'Local Ownership',
    'Community Involvement',
    'Accessibility',
    'Public & Civic Activity'
];


// Submit a Business
app.post('/api/suggestions', submissionLimiter, async function (req, res) {

    try {

        // Collect submitted information
        const {
            businessName,
            location,
            website,
            reason,
            categories
        } = req.body;

        // Check required fields
        if (
            typeof businessName !== 'string' ||
            typeof location !== 'string' ||
            !businessName.trim() ||
            !location.trim()
        ) {
            return res.status(400).json({
                message: 'Business name and location are required.'
            });
        }

        // Validate optional fields
        if (
            (website !== undefined && typeof website !== 'string') ||
            (reason !== undefined && typeof reason !== 'string') ||
            !Array.isArray(categories) ||
            !categories.every(category => allowedCategories.includes(category))
        ) {
            return res.status(400).json({
                message: 'Please check your submission information.'
            });
        }

        // Check field lengths
        if (
            businessName.trim().length > 150 ||
            location.trim().length > 150 ||
            (reason || '').length > 2000 ||
            (website || '').length > 2048
        ) {
            return res.status(400).json({
                message: 'One or more fields are too long.'
            });
        }

        // Check website format, if provided
        if (website) {
            try {
                const websiteURL = new URL(website);
                if (!['http:', 'https:'].includes(websiteURL.protocol)) {
                    throw new Error('Invalid website protocol');
                }
            } catch (error) {
                return res.status(400).json({
                    message: 'Please enter a valid website URL.'
                });
            }
        }

        // Create and save the suggestion
        const newSuggestion = new Suggestion({
            businessName,
            location,
            website: website || '',
            reason: reason || '',
            categories
        });

        await newSuggestion.save();
        // Respond after MongoDB successfully saves the submission
        res.status(201).json({
            message: 'Business suggestion received successfully.',
            id: newSuggestion._id
        });

    } catch (error) {
        console.error('Submission error:', error);
        res.status(500).json({
            message: 'Unable to save suggestion. Please try again.'
        });
    }
});

// Start Server
app.listen(PORT, function () {
    console.log(`Good Business server running on port ${PORT}`);
});
