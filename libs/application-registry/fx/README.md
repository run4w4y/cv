# Application registry FX

Frankfurter-backed exchange-rate services and currency conversion. Rates use a
bounded Effect cache within a Worker isolate and D1 persistence through
`FxRatesCrud` across isolates.
