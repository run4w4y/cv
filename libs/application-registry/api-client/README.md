# Application registry client

The generated Effect HTTP client for the application registry. It derives its
endpoint methods and codecs directly from the `HttpApi` declaration in
`@cv/application-registry-api-contract` and adds bearer authentication at the HTTP
client boundary.

The package contains no separately maintained paths or response models. Server
contracts remain in `@cv/application-registry-api-contract`; consumers that call the API
depend on this package for client construction and its Effect service layer.
