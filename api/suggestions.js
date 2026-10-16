const mongoose = require('mongoose');

// MongoDB Connection
let connectionPromise;

function connectDB() {

    if (!connectionPromise) {

        connectionPromise = mongoose.connect(process.env.MONGODB_URI)
            .catch(function (error) {
                connectionPromise = null;
                throw error;
            });

    }

    return connectionPromise;
}

// Business Suggestion Schema
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
        default: 'Pending verification'
    },

    submittedAt: {
        type: Date,
        default: Date.now
    }

}, {
    collection: 'suggestions'
});


// Create the Suggestion Model
const Suggestion = mongoose.models.Suggestion ||
    mongoose.model('Suggestion', suggestionSchema);

// Allowed Categories
const allowedCategories = [
    'Sustainability',
    'Local Ownership',
    'Community Involvement',
    'Accessibility',
    'Public & Civic Activity'
];

// Handle Business Submissions
module.exports = async function handler(req, res) {

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            message: 'Method not allowed.'
        });
    }

    try {

        // Collect form information
        const {
            businessName,
            location,
            website = '',
            reason = '',
            categories = []
        } = req.body || {};

        // Validate required fields
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

        // Validate submitted information
        if (
            typeof website !== 'string' ||
            typeof reason !== 'string' ||
            !Array.isArray(categories) ||
            !categories.every(category => allowedCategories.includes(category)) ||
            businessName.trim().length > 150 ||
            location.trim().length > 150 ||
            website.length > 2048 ||
            reason.length > 2000
        ) {
            return res.status(400).json({
                message: 'Please check your submission information.'
            });
        }

        // Validate website if provided
        if (website) {

            try {
                const url = new URL(website);
                if (!['http:', 'https:'].includes(url.protocol)) {
                    throw new Error('Invalid website URL');
                }
            } catch (error) {
                return res.status(400).json({
                    message: 'Please enter a valid website URL.'
                });
            }
        }

        // Connect to MongoDB
        await connectDB();

        // Save the submitted business
        const suggestion = await Suggestion.create({
            businessName,
            location,
            website,
            reason,
            categories
        });

        // Confirm successful submission
        return res.status(201).json({
            message: 'Business suggestion received successfully.',
            id: suggestion._id
        });

    } catch (error) {

        console.error('Submission error:', error);
        return res.status(500).json({
            message: 'Unable to save suggestion. Please try again.'
        });
    }
};
