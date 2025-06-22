const { Router } = require('express');
const uploadController = require('../controllers/upload.controller');
const multer = require('multer');


const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 200 * 1024 * 1024 } 
});

const router = Router();

router.post('/upload', upload.array('pdfs'), uploadController.handleUpload);
router.get('/ingest-status', uploadController.getIngestStatus);

module.exports = router;