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
  defaultProbabilities: {
    fluctuating: 0.35, large_spike: 0.25,decreasing: 0.15,small_spike: 0.25
  },
  transitionProbabilities: {
    fluctuating: {
      fluctuating: 0.2, large_spike: 0.3, decreasing: 0.15, small_spike: 0.35
    },
    large_spike: {
      fluctuating: 0.5, large_spike: 0.05, decreasing: 0.2, small_spike: 0.25
    },
    decreasing: {
      fluctuating: 0.25, large_spike: 0.45, decreasing: 0.05, small_spike: 0.25
    },
    small_spike: {
      fluctuating: 0.45, large_spike: 0.25, decreasing: 0.15, small_spike: 0.15
    }
  }
})
