const { Router } = require('express');
const uploadController = require('../controllers/upload.controller');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const destPath = path.resolve(__dirname, '../../../PDFs');
        console.log(`[Multer] Salvando arquivos em: ${destPath}`);
        cb(null, destPath);
    },
    filename: function (req, file, cb) {
        const decodedFilename = Buffer.from(file.originalname).toString('utf8');
        cb(null, decodedFilename);
    }
});
const upload = multer({ storage: storage });
const router = Router();

router.post('/upload', upload.array('pdfs'), uploadController.handleUpload);
router.get('/ingest-status', uploadController.getIngestStatus);

module.exports = router;