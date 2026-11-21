pipeline {
  agent any

  environment {
    COMPOSE_PROJECT_NAME = "pineapple-notes"
    // Por defecto /api usa el proxy interno de Nginx (pineapple-front -> pineapple-back:3000)
    VITE_API_BASE_URL    = "/api"
    // Añade aquí tu dominio público separado por comas si usas un dominio distinto al proxy
    ALLOWED_ORIGINS      = "https://pineapple.cheffit.duckdns.org"
  }

  options { timestamps() }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Deploy') {
      steps {
        withCredentials([
          string(credentialsId: 'DATABASE_URL', variable: 'DATABASE_URL'),
          string(credentialsId: 'PINEAPPLE_ACCESS_TOKEN_SECRET', variable: 'ACCESS_TOKEN_SECRET'),
          string(credentialsId: 'PINEAPPLE_REFRESH_TOKEN_SECRET', variable: 'REFRESH_TOKEN_SECRET'),
          // Si prefieres usar formato JDBC + usuario/contraseña en lugar de DATABASE_URL, descomenta estas 3 líneas:
          // string(credentialsId: 'PINEAPPLE_POSTGRES_URI', variable: 'POSTGRES_URI'),
          // string(credentialsId: 'PINEAPPLE_POSTGRES_USER', variable: 'POSTGRES_USER'),
          // string(credentialsId: 'PINEAPPLE_POSTGRES_PASSWORD', variable: 'POSTGRES_PASSWORD'),
        ]) {
          sh '''
            set -e

            # Exportar variables para que docker compose las reciba
            export DATABASE_URL="${DATABASE_URL}"
            export ACCESS_TOKEN_SECRET="${ACCESS_TOKEN_SECRET}"
            export REFRESH_TOKEN_SECRET="${REFRESH_TOKEN_SECRET}"
            export VITE_API_BASE_URL="${VITE_API_BASE_URL}"
            export ALLOWED_ORIGINS="${ALLOWED_ORIGINS}"

            docker compose -p ${COMPOSE_PROJECT_NAME} down || true
            docker compose -p ${COMPOSE_PROJECT_NAME} up -d --build
            docker compose -p ${COMPOSE_PROJECT_NAME} ps
          '''
        }
      }
    }
  }

  post {
    always {
      sh 'docker image prune -f || true'
    }
  }
}
