# CV v1 used these values to build encrypted static profile payloads. The v2
# system stores opaque reviewed revisions in MinIO, so Terraform relinquishes the
# obsolete values without deleting the historical Infisical secrets.
removed {
  from = infisical_secret.content_id_salt

  lifecycle {
    destroy = false
  }
}

removed {
  from = infisical_secret.private_content_root_key

  lifecycle {
    destroy = false
  }
}

removed {
  from = random_password.content_id_salt

  lifecycle {
    destroy = false
  }
}

removed {
  from = random_id.private_content_root_key

  lifecycle {
    destroy = false
  }
}
