export default (value) => ({
  buyPrice: value,
  knownPrices: {},
  previousPattern: null,
  rejectionReasons: {
    fluctuating: [], large_spike: [], decreasing: [], small_spike: []
  },
  scoreReasons: {
    fluctuating: [], large_spike: [], decreasing: [], small_spike: []
  },
})
