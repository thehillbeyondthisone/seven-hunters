param(
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [string]$Addresses = '127.0.0.1'
)
$ErrorActionPreference = 'Stop'
# Generate only local files. Nothing is installed into Windows' trust stores.
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    'CN=Seven Hunters local VR preview', $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
)
$san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$san.AddDnsName('localhost')
foreach ($address in $Addresses.Split(',')) { $san.AddIpAddress([System.Net.IPAddress]::Parse($address)) }
$request.CertificateExtensions.Add($san.Build())
$request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $false, 0, $true))
$usage = [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign
$request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new($usage, $true))
$oids = [System.Security.Cryptography.OidCollection]::new()
[void]$oids.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
$request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oids, $false))
$cert = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddDays(-1), [DateTimeOffset]::UtcNow.AddDays(90))
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
[System.IO.File]::WriteAllText((Join-Path $OutputDirectory 'cert.pem'), $cert.ExportCertificatePem())
[System.IO.File]::WriteAllText((Join-Path $OutputDirectory 'key.pem'), $rsa.ExportPkcs8PrivateKeyPem())
[System.IO.File]::WriteAllBytes((Join-Path $OutputDirectory 'certificate.cer'), $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
$cert.Dispose()
$rsa.Dispose()
