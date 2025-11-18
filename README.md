# Lheb Store Render Deployment

## Structure
- Put all your frontend files (index.html, logo.jpg, product.JPG, background.jpg) inside the `public/` folder.
- Deploy as a Web Service on Render.

## Endpoint
POST /submit-order  
FormData fields expected:
- receipt (required)
- receipt2 (optional)
- snap (required)
- service_title (text)
- amount (text)

## Notes
- Render filesystem is ephemeral. Uploaded files are lost on restart.
- Use S3 or another storage if you need permanent storage.
