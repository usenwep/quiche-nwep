// Copyright (C) 2025, Ethan Pelletier
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
// IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
// THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
// PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
// LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
// NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

//! NWEP (New Web Exchange Protocol) support.
//!
//! This module implements NWEP-specific types and functions, including
//! method and status token handling.

use super::Error;
use super::Result;

/// NWEP request methods.
///
/// NWEP defines a minimal set of semantically clear methods to replace
/// HTTP's method sprawl.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Method {
    /// Retrieve resource (replaces GET/HEAD).
    ///
    /// Safe: Yes, Idempotent: Yes, Cacheable: Yes
    Read,

    /// Create or replace resource (replaces POST/PUT).
    ///
    /// Safe: No, Idempotent: Yes, Cacheable: No
    Write,

    /// Partial update to resource (replaces PATCH).
    ///
    /// Safe: No, Idempotent: No, Cacheable: No
    Modify,

    /// Remove resource (same as HTTP DELETE).
    ///
    /// Safe: No, Idempotent: Yes, Cacheable: No
    Delete,

    /// Query supported methods/capabilities (replaces OPTIONS).
    ///
    /// Safe: Yes, Idempotent: Yes, Cacheable: No
    Probe,

    /// Establish tunnel (same as HTTP CONNECT).
    ///
    /// Safe: No, Idempotent: No, Cacheable: No
    Connect,

    /// Echo request for diagnostics (same as HTTP TRACE).
    ///
    /// Safe: Yes, Idempotent: Yes, Cacheable: No
    Trace,
}

impl Method {
    /// Parse a method from bytes.
    ///
    /// Returns an error if the method is not recognized.
    pub fn from_bytes(method: &[u8]) -> Result<Self> {
        match method {
            b"READ" => Ok(Method::Read),
            b"WRITE" => Ok(Method::Write),
            b"MODIFY" => Ok(Method::Modify),
            b"DELETE" => Ok(Method::Delete),
            b"PROBE" => Ok(Method::Probe),
            b"CONNECT" => Ok(Method::Connect),
            b"TRACE" => Ok(Method::Trace),
            _ => Err(Error::MessageError),
        }
    }

    /// Convert method to bytes.
    pub fn as_bytes(&self) -> &'static [u8] {
        match self {
            Method::Read => b"READ",
            Method::Write => b"WRITE",
            Method::Modify => b"MODIFY",
            Method::Delete => b"DELETE",
            Method::Probe => b"PROBE",
            Method::Connect => b"CONNECT",
            Method::Trace => b"TRACE",
        }
    }

    /// Check if method is safe (does not modify state).
    ///
    /// Safe methods: READ, PROBE, TRACE
    pub fn is_safe(&self) -> bool {
        matches!(self, Method::Read | Method::Probe | Method::Trace)
    }

    /// Check if method is idempotent (can be retried).
    ///
    /// Idempotent methods: READ, WRITE, DELETE, PROBE, TRACE
    pub fn is_idempotent(&self) -> bool {
        matches!(
            self,
            Method::Read |
                Method::Write |
                Method::Delete |
                Method::Probe |
                Method::Trace
        )
    }

    /// Check if method is cacheable.
    ///
    /// Cacheable methods: READ
    pub fn is_cacheable(&self) -> bool {
        matches!(self, Method::Read)
    }

    /// Convert from HTTP method for gateway compatibility.
    ///
    /// Returns `None` if the HTTP method doesn't map to a NWEP method.
    pub fn from_http_method(method: &[u8]) -> Option<Self> {
        match method {
            b"GET" | b"HEAD" => Some(Method::Read),
            b"POST" | b"PUT" => Some(Method::Write),
            b"PATCH" => Some(Method::Modify),
            b"DELETE" => Some(Method::Delete),
            b"OPTIONS" => Some(Method::Probe),
            b"CONNECT" => Some(Method::Connect),
            b"TRACE" => Some(Method::Trace),
            _ => None,
        }
    }

    /// Convert to HTTP method for gateway compatibility.
    ///
    /// Returns the most common HTTP equivalent.
    pub fn to_http_method(&self) -> &'static [u8] {
        match self {
            Method::Read => b"GET",
            Method::Write => b"POST",
            Method::Modify => b"PATCH",
            Method::Delete => b"DELETE",
            Method::Probe => b"OPTIONS",
            Method::Connect => b"CONNECT",
            Method::Trace => b"TRACE",
        }
    }
}

/// NWEP response status tokens.
///
/// NWEP uses human-readable text tokens instead of numeric HTTP status codes.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum StatusToken {
    // 1xx Informational
    /// Continue with request (HTTP 100).
    Continue,
    /// Protocol upgrade accepted (HTTP 101).
    SwitchingProtocols,

    // 2xx Success
    /// Request succeeded (HTTP 200).
    Ok,
    /// New resource created (HTTP 201).
    Created,
    /// Request accepted, processing async (HTTP 202).
    Accepted,
    /// Success, no body to return (HTTP 204).
    NoContent,
    /// Partial resource returned (HTTP 206).
    PartialContent,

    // 3xx Redirection
    /// Resource permanently moved (HTTP 301).
    MovedPermanently,
    /// Resource temporarily at different URI (HTTP 302).
    Found,
    /// Result available at different URI (HTTP 303).
    SeeOther,
    /// Cached version still valid (HTTP 304).
    NotModified,
    /// Temporarily at different URI, preserve method (HTTP 307).
    TemporaryRedirect,
    /// Permanently moved, preserve method (HTTP 308).
    PermanentRedirect,

    // 4xx Client Error
    /// Malformed request (HTTP 400).
    BadRequest,
    /// Authentication required (HTTP 401).
    Unauthorized,
    /// Access denied (HTTP 403).
    Forbidden,
    /// Resource does not exist (HTTP 404).
    NotFound,
    /// Method not supported for resource (HTTP 405).
    MethodNotAllowed,
    /// Request conflicts with current state (HTTP 409).
    Conflict,
    /// Resource permanently removed (HTTP 410).
    Gone,
    /// Request body exceeds limits (HTTP 413).
    PayloadTooLarge,
    /// Content-Type not supported (HTTP 415).
    UnsupportedMediaType,
    /// Rate limit exceeded (HTTP 429).
    TooManyRequests,

    // 5xx Server Error
    /// Generic server error (HTTP 500).
    InternalError,
    /// Method not supported (HTTP 501).
    NotImplemented,
    /// Invalid upstream response (HTTP 502).
    BadGateway,
    /// Temporarily unavailable (HTTP 503).
    ServiceUnavailable,
    /// Upstream timeout (HTTP 504).
    GatewayTimeout,
}

impl StatusToken {
    /// Parse a status token from bytes.
    ///
    /// Unknown tokens are treated as `InternalError` per NWEP spec.
    pub fn from_bytes(token: &[u8]) -> Self {
        match token {
            b"continue" => StatusToken::Continue,
            b"switching_protocols" => StatusToken::SwitchingProtocols,

            b"ok" => StatusToken::Ok,
            b"created" => StatusToken::Created,
            b"accepted" => StatusToken::Accepted,
            b"no_content" => StatusToken::NoContent,
            b"partial_content" => StatusToken::PartialContent,

            b"moved_permanently" => StatusToken::MovedPermanently,
            b"found" => StatusToken::Found,
            b"see_other" => StatusToken::SeeOther,
            b"not_modified" => StatusToken::NotModified,
            b"temporary_redirect" => StatusToken::TemporaryRedirect,
            b"permanent_redirect" => StatusToken::PermanentRedirect,

            b"bad_request" => StatusToken::BadRequest,
            b"unauthorized" => StatusToken::Unauthorized,
            b"forbidden" => StatusToken::Forbidden,
            b"not_found" => StatusToken::NotFound,
            b"method_not_allowed" => StatusToken::MethodNotAllowed,
            b"conflict" => StatusToken::Conflict,
            b"gone" => StatusToken::Gone,
            b"payload_too_large" => StatusToken::PayloadTooLarge,
            b"unsupported_media_type" => StatusToken::UnsupportedMediaType,
            b"too_many_requests" => StatusToken::TooManyRequests,

            b"internal_error" => StatusToken::InternalError,
            b"not_implemented" => StatusToken::NotImplemented,
            b"bad_gateway" => StatusToken::BadGateway,
            b"service_unavailable" => StatusToken::ServiceUnavailable,
            b"gateway_timeout" => StatusToken::GatewayTimeout,

            // Unknown tokens default to internal_error
            _ => {
                warn!(
                    "Unknown NWEP status token {:?}, treating as internal_error",
                    std::str::from_utf8(token).unwrap_or("<invalid utf8>")
                );
                StatusToken::InternalError
            },
        }
    }

    /// Convert status token to bytes.
    pub fn as_bytes(&self) -> &'static [u8] {
        match self {
            StatusToken::Continue => b"continue",
            StatusToken::SwitchingProtocols => b"switching_protocols",

            StatusToken::Ok => b"ok",
            StatusToken::Created => b"created",
            StatusToken::Accepted => b"accepted",
            StatusToken::NoContent => b"no_content",
            StatusToken::PartialContent => b"partial_content",

            StatusToken::MovedPermanently => b"moved_permanently",
            StatusToken::Found => b"found",
            StatusToken::SeeOther => b"see_other",
            StatusToken::NotModified => b"not_modified",
            StatusToken::TemporaryRedirect => b"temporary_redirect",
            StatusToken::PermanentRedirect => b"permanent_redirect",

            StatusToken::BadRequest => b"bad_request",
            StatusToken::Unauthorized => b"unauthorized",
            StatusToken::Forbidden => b"forbidden",
            StatusToken::NotFound => b"not_found",
            StatusToken::MethodNotAllowed => b"method_not_allowed",
            StatusToken::Conflict => b"conflict",
            StatusToken::Gone => b"gone",
            StatusToken::PayloadTooLarge => b"payload_too_large",
            StatusToken::UnsupportedMediaType => b"unsupported_media_type",
            StatusToken::TooManyRequests => b"too_many_requests",

            StatusToken::InternalError => b"internal_error",
            StatusToken::NotImplemented => b"not_implemented",
            StatusToken::BadGateway => b"bad_gateway",
            StatusToken::ServiceUnavailable => b"service_unavailable",
            StatusToken::GatewayTimeout => b"gateway_timeout",
        }
    }

    /// Convert to HTTP status code for gateway compatibility.
    pub fn to_http_code(&self) -> u16 {
        match self {
            StatusToken::Continue => 100,
            StatusToken::SwitchingProtocols => 101,

            StatusToken::Ok => 200,
            StatusToken::Created => 201,
            StatusToken::Accepted => 202,
            StatusToken::NoContent => 204,
            StatusToken::PartialContent => 206,

            StatusToken::MovedPermanently => 301,
            StatusToken::Found => 302,
            StatusToken::SeeOther => 303,
            StatusToken::NotModified => 304,
            StatusToken::TemporaryRedirect => 307,
            StatusToken::PermanentRedirect => 308,

            StatusToken::BadRequest => 400,
            StatusToken::Unauthorized => 401,
            StatusToken::Forbidden => 403,
            StatusToken::NotFound => 404,
            StatusToken::MethodNotAllowed => 405,
            StatusToken::Conflict => 409,
            StatusToken::Gone => 410,
            StatusToken::PayloadTooLarge => 413,
            StatusToken::UnsupportedMediaType => 415,
            StatusToken::TooManyRequests => 429,

            StatusToken::InternalError => 500,
            StatusToken::NotImplemented => 501,
            StatusToken::BadGateway => 502,
            StatusToken::ServiceUnavailable => 503,
            StatusToken::GatewayTimeout => 504,
        }
    }

    /// Convert from HTTP status code for gateway compatibility.
    ///
    /// Returns `None` if the code doesn't map to a defined NWEP token.
    pub fn from_http_code(code: u16) -> Option<Self> {
        match code {
            100 => Some(StatusToken::Continue),
            101 => Some(StatusToken::SwitchingProtocols),

            200 => Some(StatusToken::Ok),
            201 => Some(StatusToken::Created),
            202 => Some(StatusToken::Accepted),
            204 => Some(StatusToken::NoContent),
            206 => Some(StatusToken::PartialContent),

            301 => Some(StatusToken::MovedPermanently),
            302 => Some(StatusToken::Found),
            303 => Some(StatusToken::SeeOther),
            304 => Some(StatusToken::NotModified),
            307 => Some(StatusToken::TemporaryRedirect),
            308 => Some(StatusToken::PermanentRedirect),

            400 => Some(StatusToken::BadRequest),
            401 => Some(StatusToken::Unauthorized),
            403 => Some(StatusToken::Forbidden),
            404 => Some(StatusToken::NotFound),
            405 => Some(StatusToken::MethodNotAllowed),
            409 => Some(StatusToken::Conflict),
            410 => Some(StatusToken::Gone),
            413 => Some(StatusToken::PayloadTooLarge),
            415 => Some(StatusToken::UnsupportedMediaType),
            429 => Some(StatusToken::TooManyRequests),

            500 => Some(StatusToken::InternalError),
            501 => Some(StatusToken::NotImplemented),
            502 => Some(StatusToken::BadGateway),
            503 => Some(StatusToken::ServiceUnavailable),
            504 => Some(StatusToken::GatewayTimeout),

            _ => None,
        }
    }

    /// Get the status class (informational, success, redirect, client_error, server_error).
    pub fn class(&self) -> StatusClass {
        let code = self.to_http_code();
        match code / 100 {
            1 => StatusClass::Informational,
            2 => StatusClass::Success,
            3 => StatusClass::Redirect,
            4 => StatusClass::ClientError,
            5 => StatusClass::ServerError,
            _ => StatusClass::ServerError, // Should never happen
        }
    }
}

/// NWEP status class.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum StatusClass {
    /// 1xx Informational
    Informational,
    /// 2xx Success
    Success,
    /// 3xx Redirection
    Redirect,
    /// 4xx Client Error
    ClientError,
    /// 5xx Server Error
    ServerError,
}

impl StatusClass {
    /// Convert to string for `status-class` header (if needed in future).
    pub fn as_str(&self) -> &'static str {
        match self {
            StatusClass::Informational => "informational",
            StatusClass::Success => "success",
            StatusClass::Redirect => "redirect",
            StatusClass::ClientError => "client_error",
            StatusClass::ServerError => "server_error",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_method_parsing() {
        assert_eq!(Method::from_bytes(b"READ").unwrap(), Method::Read);
        assert_eq!(Method::from_bytes(b"WRITE").unwrap(), Method::Write);
        assert_eq!(Method::from_bytes(b"MODIFY").unwrap(), Method::Modify);
        assert_eq!(Method::from_bytes(b"DELETE").unwrap(), Method::Delete);
        assert_eq!(Method::from_bytes(b"PROBE").unwrap(), Method::Probe);
        assert_eq!(Method::from_bytes(b"CONNECT").unwrap(), Method::Connect);
        assert_eq!(Method::from_bytes(b"TRACE").unwrap(), Method::Trace);

        assert!(Method::from_bytes(b"GET").is_err());
        assert!(Method::from_bytes(b"POST").is_err());
    }

    #[test]
    fn test_method_properties() {
        assert!(Method::Read.is_safe());
        assert!(Method::Read.is_idempotent());
        assert!(Method::Read.is_cacheable());

        assert!(!Method::Write.is_safe());
        assert!(Method::Write.is_idempotent());
        assert!(!Method::Write.is_cacheable());

        assert!(!Method::Modify.is_safe());
        assert!(!Method::Modify.is_idempotent());
    }

    #[test]
    fn test_method_http_conversion() {
        assert_eq!(Method::from_http_method(b"GET"), Some(Method::Read));
        assert_eq!(Method::from_http_method(b"POST"), Some(Method::Write));
        assert_eq!(Method::from_http_method(b"PATCH"), Some(Method::Modify));

        assert_eq!(Method::Read.to_http_method(), b"GET");
        assert_eq!(Method::Write.to_http_method(), b"POST");
    }

    #[test]
    fn test_status_parsing() {
        assert_eq!(StatusToken::from_bytes(b"ok"), StatusToken::Ok);
        assert_eq!(
            StatusToken::from_bytes(b"not_found"),
            StatusToken::NotFound
        );
        assert_eq!(
            StatusToken::from_bytes(b"internal_error"),
            StatusToken::InternalError
        );

        // Unknown tokens default to internal_error
        assert_eq!(
            StatusToken::from_bytes(b"unknown_status"),
            StatusToken::InternalError
        );
    }

    #[test]
    fn test_status_http_conversion() {
        assert_eq!(StatusToken::Ok.to_http_code(), 200);
        assert_eq!(StatusToken::NotFound.to_http_code(), 404);
        assert_eq!(StatusToken::InternalError.to_http_code(), 500);

        assert_eq!(StatusToken::from_http_code(200), Some(StatusToken::Ok));
        assert_eq!(
            StatusToken::from_http_code(404),
            Some(StatusToken::NotFound)
        );
        assert_eq!(StatusToken::from_http_code(999), None);
    }

    #[test]
    fn test_status_class() {
        assert_eq!(StatusToken::Ok.class(), StatusClass::Success);
        assert_eq!(StatusToken::NotFound.class(), StatusClass::ClientError);
        assert_eq!(
            StatusToken::InternalError.class(),
            StatusClass::ServerError
        );
    }
}
