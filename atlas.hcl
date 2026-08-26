data "external_schema" "drizzle" {
  program = [
    "./node_modules/.bin/drizzle-kit",
    "export"
  ]
}

data "external_schema" "drizzle_reference" {
  program = [
    "./node_modules/.bin/drizzle-kit",
    "export",
    "--config=drizzle.reference.config.ts"
  ]
}

env "dev" {
  url = getenv("DB_DATABASE_URL")
  dev = getenv("DB_ATLAS")

  schema {
    src = data.external_schema.drizzle.url
  }

  migration {
    dir = "file://atlas/seed/dev"
  }
}

env "prod" {
  url = getenv("DB_DATABASE_URL")
  dev = getenv("DB_ATLAS")

  schema {
    src = data.external_schema.drizzle.url
  }

  migration {
    dir = "file://atlas/prod"
  }
}

env "reference" {
  dev = getenv("DB_ATLAS")

  schema {
    src = data.external_schema.drizzle_reference.url
  }

  migration {
    dir = "file://packages/models/reference/atlas"
  }
}
