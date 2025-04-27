declare global {
  interface Window {
    ethereum?: ethers.providers.ExternalProvider;
  }
}