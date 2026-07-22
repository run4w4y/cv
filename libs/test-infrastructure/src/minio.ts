import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers'

export const minioTestImage = 'minio/minio:RELEASE.2025-09-07T16-13-09Z'

const minioApiPort = 9000

export interface MinioTestContainerOptions {
  readonly accessKeyId?: string
  readonly image?: string
  readonly region?: string
  readonly secretAccessKey?: string
}

export interface StartedMinioTestContainer extends AsyncDisposable {
  readonly accessKeyId: string
  readonly container: StartedTestContainer
  readonly endpoint: URL
  readonly forcePathStyle: true
  readonly region: string
  readonly secretAccessKey: string
  readonly dispose: () => Promise<void>
}

export const startMinioTestContainer = async (
  options: MinioTestContainerOptions = {}
): Promise<StartedMinioTestContainer> => {
  const accessKeyId = options.accessKeyId ?? 'cv-test-access'
  const secretAccessKey = options.secretAccessKey ?? 'cv-test-secret'
  const container = await new GenericContainer(options.image ?? minioTestImage)
    .withEnvironment({
      MINIO_ROOT_PASSWORD: secretAccessKey,
      MINIO_ROOT_USER: accessKeyId,
    })
    .withCommand(['server', '/data'])
    .withExposedPorts(minioApiPort)
    .withWaitStrategy(Wait.forHttp('/minio/health/live', minioApiPort))
    .start()
  let disposed = false
  const dispose = async () => {
    if (disposed) return
    disposed = true
    await container.stop()
  }

  return {
    accessKeyId,
    container,
    dispose,
    endpoint: new URL(
      `http://${container.getHost()}:${container.getMappedPort(minioApiPort)}`
    ),
    forcePathStyle: true,
    region: options.region ?? 'us-east-1',
    secretAccessKey,
    [Symbol.asyncDispose]: dispose,
  }
}
