// Quick test script to check working hours settings
// Run with: node test-working-hours.js

async function testWorkingHours() {
  try {
    // Test 1: Check if settings are being saved
    console.log('Testing working hours settings...\n');

    const testSettings = {
      enabled: true,
      startHour: 9,
      endHour: 17,
      allowedDays: [1, 2, 4] // Monday, Tuesday, Thursday
    };

    console.log('1. Sending settings to API:');
    console.log(JSON.stringify(testSettings, null, 2));

    const saveResponse = await fetch('http://localhost:3000/api/admin/settings/working-hours', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testSettings),
      credentials: 'include' // Include cookies
    });

    const saveResult = await saveResponse.json();
    console.log('\n2. Save response:');
    console.log(JSON.stringify(saveResult, null, 2));

    if (!saveResponse.ok) {
      console.error('\n❌ Failed to save settings!');
      console.error('Status:', saveResponse.status);
      console.error('Make sure you are logged in as ADMIN');
      return;
    }

    // Test 2: Retrieve settings
    console.log('\n3. Retrieving settings...');
    const getResponse = await fetch('http://localhost:3000/api/admin/settings/working-hours', {
      credentials: 'include'
    });

    const getResult = await getResponse.json();
    console.log('\n4. Retrieved settings:');
    console.log(JSON.stringify(getResult, null, 2));

    console.log('\n✅ Settings test complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Log out from your admin account');
    console.log('2. Try logging in as an EMPLOYEE user');
    console.log('3. If current time is outside 9 AM - 5 PM OR today is not Mon/Tue/Thu,');
    console.log('   you should see an error message blocking login');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. The app is running (npm run dev)');
    console.error('2. You are logged in as ADMIN in your browser');
    console.error('3. Database is connected');
  }
}

testWorkingHours();
