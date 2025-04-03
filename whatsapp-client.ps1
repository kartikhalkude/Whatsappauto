# WhatsApp API Client Script
$baseUrl = "http://localhost:3000"

function New-WhatsAppSession {
    param (
        [Parameter(Mandatory=$true)]
        [string]$SessionId
    )
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    $body = @{
        "sessionId" = $SessionId
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/session/create" -Method Post -Headers $headers -Body $body -ContentType "application/json"
        Write-Host "Session created successfully. Scan the QR code that appears in the terminal."
        return $response
    }
    catch {
        Write-Error "Failed to create session: $_"
    }
}

function Send-WhatsAppMessage {
    param (
        [Parameter(Mandatory=$true)]
        [string]$SessionId,
        
        [Parameter(Mandatory=$true)]
        [string]$Phone,
        
        [Parameter(Mandatory=$true)]
        [string]$Message
    )
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    $body = @{
        "sessionId" = $SessionId
        "phone" = $Phone
        "message" = $Message
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/send-message" -Method Post -Headers $headers -Body $body -ContentType "application/json"
        Write-Host "Message sent successfully"
        return $response
    }
    catch {
        Write-Error "Failed to send message: $_"
    }
}

function Get-WhatsAppContacts {
    param (
        [Parameter(Mandatory=$true)]
        [string]$SessionId
    )
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/contacts/$SessionId" -Method Get
        Write-Host "Retrieved $($response.contactCount) contacts"
        return $response
    }
    catch {
        Write-Error "Failed to get contacts: $_"
    }
}

function Get-WhatsAppSessions {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/sessions" -Method Get
        Write-Host "Active sessions: $($response.sessions -join ', ')"
        return $response
    }
    catch {
        Write-Error "Failed to get sessions: $_"
    }
}

function Close-WhatsAppSession {
    param (
        [Parameter(Mandatory=$true)]
        [string]$SessionId
    )
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    $body = @{
        "sessionId" = $SessionId
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/session/close" -Method Post -Headers $headers -Body $body -ContentType "application/json"
        Write-Host "Session closed successfully"
        return $response
    }
    catch {
        Write-Error "Failed to close session: $_"
    }
}

function Get-WhatsAppSessionStatus {
    param (
        [Parameter(Mandatory=$true)]
        [string]$SessionId
    )
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/session/$SessionId/status" -Method Get
        Write-Host "Session $SessionId status: $(if($response.authenticated){'Authenticated'}else{'Not Authenticated'})"
        return $response
    }
    catch {
        Write-Error "Failed to get session status: $_"
    }
}

function Get-WhatsAppQRCode {
    param (
        [Parameter(Mandatory=$true)]
        [string]$SessionId
    )
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/api/session/$SessionId/qr" -Method Get
        
        if ($response.authenticated) {
            Write-Host "Session is already authenticated, no QR code needed."
            return $response
        }
        
        if ($response.qrCode -and $response.qrCode.base64Image) {
            Write-Host "QR Code received. Please scan it with your WhatsApp app."
            # You could save the QR code to a file here if needed
            # [System.IO.File]::WriteAllBytes("$SessionId-qr.png", [Convert]::FromBase64String($response.qrCode.base64Image))
            # Write-Host "QR code saved to $SessionId-qr.png"
            return $response
        } else {
            Write-Host "No QR code available for this session."
            return $response
        }
    }
    catch {
        Write-Error "Failed to get QR code: $_"
    }
}

# Example usage:
Write-Host "WhatsApp API Client Functions Available:"
Write-Host "----------------------------------------"
Write-Host "New-WhatsAppSession -SessionId 'user1'"
Write-Host "Get-WhatsAppQRCode -SessionId 'user1'"
Write-Host "Get-WhatsAppSessionStatus -SessionId 'user1'"
Write-Host "Send-WhatsAppMessage -SessionId 'user1' -Phone '919766851268' -Message 'Hello!'"
Write-Host "Get-WhatsAppContacts -SessionId 'user1'"
Write-Host "Get-WhatsAppSessions"
Write-Host "Close-WhatsAppSession -SessionId 'user1'"
Write-Host "----------------------------------------"
Write-Host "Web UI available at: http://localhost:3000" 