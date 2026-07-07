{
  description = "Astro CV website devshell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    infisical-nix = {
      url = "git+ssh://git@github.com/run4w4y/infisical-nix.git";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.flake-utils.follows = "flake-utils";
    };
  };

  outputs = { nixpkgs, flake-utils, infisical-nix, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
        infisical-cli = infisical-nix.packages.${system}.infisical-cli;
      in
      with pkgs;
      {
        devShells.default = mkShell {
          buildInputs = [
            act
            bun
            chromium
            infisical-cli
            terraform
            terragrunt
            nodejs_22
          ];

          shellHook = ''
            export ASTRO_TELEMETRY_DISABLED=1
            export CV_CHROME_PATH="${chromium}/bin/chromium"
          '';
        };
      }
    );
}
