console.log('script-runner alive; accounts:', web3 ? 'web3 ok' : 'no web3');
try {
  const accs = await web3.eth.getAccounts();
  console.log('accounts[0..5]:', accs.slice(0, 6).join(', '));
} catch (e) {
  console.log('getAccounts err', e.message);
}
