pipeline {
    agent any

    environment {
        APP_IMAGE_NAME = 'node_catalog'
        APP_IMAGE_VERSION = "$BUILD_VERSION.$BUILD_NUMBER.$WEBSITE_CHOICE"
        DEPLOY_JOB = 'Catalog-deploy'
    }

    parameters {
        choice(name: 'WEBSITE_CHOICE', choices: ['altex', 'mediagalaxy'], description: 'The website you need to deploy')
        string(name: 'BUILD_BRANCH', defaultValue: 'master', description: 'Build branch')
        string(name: 'BUILD_VERSION', defaultValue: '1', description: 'Build version')
        booleanParam(name: 'EXECUTE_DEPLOY', defaultValue: false, description: 'Execute deploy')
    }

    stages {
        stage('Preparation') {
            steps{
                dir ('clone') {
                    // Get some code from a GitHub repository
                    git branch: params.BUILD_BRANCH, credentialsId: env.SSH_KEY_ID, url: scm.getUserRemoteConfigs()[0].getUrl()
                }

                 sh "cp ${env.PIPELINE_HOME}/build/${env.JOB_NAME}/${WEBSITE_CHOICE}-manifest.json clone/src/config/manifest.json"
            }
            post {
                success {
                    echo 'Successfully cloned!'
                }
                failure {
                    echo 'Failed to clone the repository.'
                }
            }
        }

        stage('Build') {
            steps {
                script {
                    dir ('clone') {
                        // Run the docker build
                        image = docker.build(env.APP_IMAGE_NAME + ':' + env.APP_IMAGE_VERSION, ' --build-arg ssh_key="$(cat ~/.ssh/'+ env.SSH_KEY_NAME +')" --build-arg port=80 . -f Dockerfile --no-cache')
                    }
                }
            }
            post {
                success {
                    echo 'The image was successfully built.'
                }

                failure {
                    echo 'Failed to build the image.'
                }
            }
        }

        stage('Test') {
            when {
                beforeAgent true
                expression {
                    params.EXECUTE_TESTS
                }
            }
            steps {
                echo 'Execute Unit Tests'
            }
        }

        stage('Publish') {
            steps {
                script {
                    docker.withRegistry('https://' + env.AMAZON_REGISTRY, env.AMAZON_REGISTRY_CREDENTIALS_ID) {
                        // push webserver image
                        image.push(env.APP_IMAGE_VERSION)
                    }
                }
            }
            post {
                success {
                    echo "The image with version ${APP_IMAGE_VERSION} was pushed with success for ${WEBSITE_CHOICE} website."
                }

                failure {
                    echo 'Failed push the images'
                }
            }
        }

        stage('Clean up') {
            steps {
                sh 'rm -rf clone scm'
                sh 'docker rmi ' + env.AMAZON_REGISTRY + '/' + env.APP_IMAGE_NAME + ':' + env.APP_IMAGE_VERSION + ' ' + image.id + ' -f'
            }
            post {
                success {
                    echo 'Successfully cleaned up.'
                }

                failure {
                    echo 'Failed to clean the mess :('
                }
            }
        }

        stage('Deploy') {
            when {
                beforeAgent true
                expression {
                    params.EXECUTE_DEPLOY
                }
            }
            steps {
                build job: env.DEPLOY_JOB, parameters: [string(name: 'WEBSITE_CHOICE', value: env.WEBSITE_CHOICE), string(name: 'APP_IMAGE_VERSION_TAG', value: "$BUILD_VERSION.$BUILD_NUMBER"), booleanParam(name: 'APP_FISRT_DEPLOY', value: false)]
            }

            post {
                success {
                    echo 'Successfully deployed.'
                }

                failure {
                    echo 'Failed to deploy.'
                }
            }
        }
    }
}
