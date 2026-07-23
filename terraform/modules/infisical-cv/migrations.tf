moved {
  from = infisical_secret_folder.child["analytics"]
  to   = infisical_secret_folder.managed_child["analytics"]
}

moved {
  from = infisical_secret_folder.child["application_registry"]
  to   = infisical_secret_folder.managed_child["application_registry"]
}

moved {
  from = infisical_secret_folder.child["deploy"]
  to   = infisical_secret_folder.managed_child["deploy"]
}

moved {
  from = infisical_secret_folder.child["facts_publication"]
  to   = infisical_secret_folder.managed_child["facts_publication"]
}

removed {
  from = infisical_secret_folder.child

  lifecycle {
    destroy = false
  }
}

removed {
  from = infisical_secret.private_audience_key

  lifecycle {
    destroy = false
  }
}
