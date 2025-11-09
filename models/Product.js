const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0
    },
    description: String,
    image: String
}, {
    timestamps: true
});

module.exports = mongoose.model('Product', productSchema);