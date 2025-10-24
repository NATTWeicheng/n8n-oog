// api/gmailRoute.js
require('dotenv').config();
const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// opens gmail and open the subject
router.post('/gmail/reply-with-attachments', async (req, res) => {
  const { threadId, attachments } = req.body;
  
  if (!threadId) {
    return res.status(400).json({ status: 'error', message: 'Missing "threadId"' });
  }

  const tempDir = path.resolve('./temp-attachments');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFiles = [];
  let context;

  try {
    // Save base64 attachments to temp files
    if (attachments && attachments.length > 0) {
      console.log(`Processing ${attachments.length} attachments...`);
      
      for (const attachment of attachments) {
        const tempPath = path.join(tempDir, attachment.filename);
        const buffer = Buffer.from(attachment.data, 'base64');
        fs.writeFileSync(tempPath, buffer);
        tempFiles.push(tempPath);
        console.log(`Saved: ${attachment.filename}`);
      }
    }

    const userDataDir = path.resolve('./pw-gmail-profile');
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: 'chrome',
      viewport: null,
      args: ['--start-maximized'],
    });

    const page = await context.newPage();
    console.log(`Opening email thread: ${threadId}`);
    
    await page.goto(`https://mail.google.com/mail/u/0/#all/${threadId}`, { 
      waitUntil: 'domcontentloaded' 
    });

    // Wait for email to load
    await page.waitForSelector('h2.hP', { timeout: 15000 });
    await page.waitForTimeout(1500);
    console.log('Email loaded');

    // Click the three-dot menu button
    const menuButton = page.locator('#qhu9y > div');
    await menuButton.waitFor({ state: 'visible', timeout: 10000 });
    await menuButton.click({ force: true });
    console.log('Clicked menu button');
    
    // Wait for menu and click Reply
    await page.waitForSelector('ul[role="menu"]', { timeout: 5000 });
    await page.waitForTimeout(500);

    const replyOption = page.locator('li[role="menuitem"][data-action-type="94"]');
    await replyOption.waitFor({ state: 'visible', timeout: 5000 });
    await replyOption.click({ force: true });
    console.log('Clicked Reply option');
    
    // Wait for reply compose box
    await page.waitForTimeout(2000);

    // Attach files if any
    if (tempFiles.length > 0) {
      console.log(`Attaching ${tempFiles.length} files...`);
      
      const fileInput = page.locator('input[type="file"][name="Filedata"]');
      await fileInput.setInputFiles(tempFiles);
      
      console.log('Files attached successfully');
      
      // Wait for upload (more time for more files)
      const waitTime = Math.min(5000 + (tempFiles.length * 500), 30000);
      await page.waitForTimeout(waitTime);
      console.log('Upload complete');
    }
    
    // Use Ctrl+Shift+B to show BCC/CC fields
    console.log('Showing BCC/CC fields...');
    await page.keyboard.press('Control+Shift+B');
    await page.waitForTimeout(1000);
    console.log('BCC/CC fields shown');
    
    // Click the X button on the existing recipient chip
    console.log('Removing existing recipient...');
    const removeButton = page.locator('div[role="option"] .af6 .afX svg').first();
    await removeButton.waitFor({ state: 'visible', timeout: 5000 });
    await removeButton.click();
    await page.waitForTimeout(500);
    console.log('Existing recipient removed');
    
    // Add new recipients to To field
    console.log('Adding To recipients...');
    
    // Type first recipient
    await page.keyboard.type('zengweicheng05144@gmail.com');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    console.log('First To recipient added: zengweicheng05144@gmail.com');
    
    // Type second recipient
    await page.keyboard.type('autothefox001@gmail.com');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    console.log('Second To recipient added: autothefox001@gmail.com');
    
    // Click on Cc field
    console.log('Adding Cc recipients...');
    const ccButton = page.locator('span.aB.gQ.pE[role="link"]').filter({ hasText: 'Cc' });
    await ccButton.waitFor({ state: 'visible', timeout: 5000 });
    await ccButton.click();
    await page.waitForTimeout(500);
    console.log('Cc field opened');
    
    // Type first Cc recipient
    await page.keyboard.type('zengweicheng05144@gmail.com');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    console.log('First Cc recipient added: zengweicheng05144@gmail.com');
    
    // Type second Cc recipient
    await page.keyboard.type('autothefox001@gmail.com');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    console.log('Second Cc recipient added: autothefox001@gmail.com');

    // Click "Type of response" button to open dropdown
    console.log('Opening response type dropdown...');
    const responseTypeButton = page.locator('div[role="button"][aria-label="Type of response"]');
    await responseTypeButton.waitFor({ state: 'visible', timeout: 5000 });
    await responseTypeButton.click();
    await page.waitForTimeout(500);
    console.log('Response type dropdown opened');
    
    // Click "Edit subject" option
    console.log('Clicking Edit subject...');
    const editSubjectOption = page.locator('text=Edit subject');
    await editSubjectOption.waitFor({ state: 'visible', timeout: 5000 });
    await editSubjectOption.click();
    await page.waitForTimeout(1000);
    console.log('Edit subject clicked');
    
    // Modify the subject line
    console.log('Modifying subject line...');
    await page.keyboard.press('Control+A'); // Select all
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+C'); // Copy
    await page.waitForTimeout(200);
    await page.keyboard.press('Control+V'); // Paste
    await page.keyboard.type(' - Job Done'); // Add suffix
    await page.waitForTimeout(500);
    console.log('Subject modified with " - Job Done"');
    
    // Click Send button
    console.log('Clicking Send button...');
    const sendButton = page.locator('div[role="button"][aria-label*="Send"]').filter({ hasText: 'Send' });
    await sendButton.waitFor({ state: 'visible', timeout: 5000 });
    await sendButton.click();
    await page.waitForTimeout(2000);
    console.log('Email sent!');
    
    // Clean up temp files
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`Deleted temp file: ${file}`);
      }
    });
    
    res.json({
      status: 'success',
      message: `Email sent with ${tempFiles.length} attachments and modified subject`,
      threadId: threadId,
      attachmentsCount: tempFiles.length,
      filenames: attachments?.map(a => a.filename) || [],
      recipients: {
        to: ['zengweicheng05144@gmail.com', 'autothefox001@gmail.com'],
        cc: ['zengweicheng05144@gmail.com', 'autothefox001@gmail.com']
      },
      subjectModified: true
    });

  } catch (error) {
    console.error('❌ Error:', error);
    
    // Clean up temp files on error
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      stack: error.stack 
    });
  } finally {
    if (context) await context.close();
  }
});

module.exports = router;
