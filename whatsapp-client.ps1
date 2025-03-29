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
        $response = Invoke-RestMethod -Uri "$baseUrl/session/create" -Method Post -Headers $headers -Body $body -ContentType "application/json"
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
        $response = Invoke-RestMethod -Uri "$baseUrl/send-message" -Method Post -Headers $headers -Body $body -ContentType "application/json"
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
        $response = Invoke-RestMethod -Uri "$baseUrl/contacts/$SessionId" -Method Get
        Write-Host "Retrieved $($response.contactCount) contacts"
        return $response
    }
    catch {
        Write-Error "Failed to get contacts: $_"
    }
}

function Get-WhatsAppSessions {
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/sessions" -Method Get
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
        $response = Invoke-RestMethod -Uri "$baseUrl/session/close" -Method Post -Headers $headers -Body $body -ContentType "application/json"
        Write-Host "Session closed successfully"
        return $response
    }
    catch {
        Write-Error "Failed to close session: $_"
    }
}

# Example usage:
Write-Host "WhatsApp API Client Functions Available:"
Write-Host "----------------------------------------"
Write-Host "New-WhatsAppSession -SessionId 'user1'"
Write-Host "Send-WhatsAppMessage -SessionId 'user1' -Phone '919766851268' -Message 'Hello!'"
Write-Host "Get-WhatsAppContacts -SessionId 'user1'"
Write-Host "Get-WhatsAppSessions"
Write-Host "Close-WhatsAppSession -SessionId 'user1'"
Write-Host "----------------------------------------" 