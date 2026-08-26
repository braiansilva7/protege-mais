data "external_schema" "drizzle" {
  program = [
    "./node_modules/.bin/drizzle-kit",
    "export"
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
