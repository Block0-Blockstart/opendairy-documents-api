/* eslint-disable @typescript-eslint/no-var-requires */
const ethers = require('ethers');

const createWallet = () => {
  const wallet = ethers.Wallet.createRandom();

  console.log({
    wallet: {
      address: wallet.address,
      publicKey: wallet.publicKey,
      mnemonic: wallet.mnemonic.phrase,
      privateKey: wallet.privateKey,
    },
  });
};

try {
  createWallet();
} catch (e) {
  console.error(e);
}
