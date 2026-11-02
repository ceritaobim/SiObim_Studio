const fs = require('fs');

fetch('http://localhost:3000/publishing', {
  headers: {
    'Cookie': 'co_studio_owner_session=co_verified_owner_365d_token_v1'
  }
})
  .then(res => {
    console.log('HTTP Status:', res.status);
    return res.text();
  })
  .then(html => {
    console.log('Has table element:', html.includes('<table'));
    console.log('Has final- prefix:', html.includes('final-'));
    console.log('Has Publishing Studio title:', html.includes('Buffer Publishing') && html.includes('Studio'));
    console.log('Sample content code CO-2026-001:', html.includes('CO-2026-001'));
    console.log('Sample title (Kenapa Temen Makin Dikit):', html.includes('Kenapa Temen Makin Dikit'));
    console.log('Sample final video (final-Kenapa Ide Brilian):', html.includes('final-Kenapa Ide Brilian Muncul Pas Lagi Mandi'));
  })
  .catch(err => console.error(err));
