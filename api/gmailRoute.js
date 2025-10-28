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
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Get existing page instead of creating new one
    const page = context.pages()[0];
    
    // Navigate directly to the email thread
    console.log(`Opening email thread: ${threadId}`);
    await page.goto(`https://mail.google.com/mail/u/0/#all/${threadId}`, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // Check if user needs to log in
    console.log('Checking login status...');
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    // Check if we're on a login/workspace page
    if (currentUrl.includes('accounts.google.com') || 
        currentUrl.includes('workspace.google.com') ||
        currentUrl.includes('signin')) {
      console.log('⚠️  User is not logged in.');
      
      // Close context and return error response
      if (context) await context.close();
      
      return res.status(200).json({
        status: 'error',
        message: 'Login is required',
        requiresLogin: true
      });
    } else {
      console.log('✅ User already logged in');
    }

    // Wait for email to load - try multiple selectors
    console.log('Waiting for email to load...');
    try {
      await page.waitForSelector('h2.hP', { timeout: 10000 });
    } catch {
      // Try alternative selectors if first one fails
      try {
        await page.waitForSelector('[role="main"]', { timeout: 5000 });
      } catch {
        await page.waitForSelector('.gs', { timeout: 5000 }); // Email body container
      }
    }
    await page.waitForTimeout(2000);
    console.log('Email loaded');

    // Click the three-dot menu button (Reply options)
    console.log('Looking for reply menu button...');
    let menuButton;
    try {
      // Try the specific ID first
      menuButton = page.locator('#qhu9y > div');
      await menuButton.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      // Fallback to aria-label
      menuButton = page.locator('[aria-label*="More options"]').first();
      await menuButton.waitFor({ state: 'visible', timeout: 5000 });
    }
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

// prompt to login to gmail
router.get('/gmail/login', async (req, res) => {
  let context;
  
  try {
    const userDataDir = path.resolve('./pw-gmail-profile');
    
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: 'chrome',
      viewport: null,
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',  // This hides automation
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ],
      ignoreDefaultArgs: ['--enable-automation'],  // Also add this
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = context.pages()[0];
    
    await page.goto('https://mail.google.com/mail/u/0/#inbox', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    console.log('Browser opened. Please log in to Gmail.');
    console.log('Waiting for login...');
    
    // Wait for Gmail interface to load (indicates successful login)
    await page.waitForSelector('div[role="navigation"]', { 
      timeout: 0
    });
    
    await page.waitForTimeout(3000);
    
    console.log('✅ Login successful!');
    
    res.json({
      status: 'success',
      message: 'Login successful. Session saved.'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  } finally {
    if (context) await context.close();
  }
});

module.exports = router;