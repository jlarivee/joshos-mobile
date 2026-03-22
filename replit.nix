{ pkgs }: {
  deps = [
    pkgs.python312
    pkgs.python312Packages.flask
    pkgs.python312Packages.pyjwt
    pkgs.python312Packages.anthropic
    pkgs.python312Packages.openpyxl
    pkgs.nodejs_22
  ];
}
