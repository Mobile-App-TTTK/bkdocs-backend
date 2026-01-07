module.exports = async () => {
  // Global teardown - clean up any remaining resources
  await new Promise((resolve) => setTimeout(resolve, 500));
};
