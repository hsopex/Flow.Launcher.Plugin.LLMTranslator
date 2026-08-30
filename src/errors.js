'use strict';

class UserError extends Error {
  constructor(message, code = 'USER_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

class ConfigurationError extends UserError {
  constructor(message) {
    super(message, 'CONFIGURATION_ERROR');
  }
}

class ApiError extends UserError {
  constructor(message, status = null) {
    super(message, 'API_ERROR');
    this.status = status;
  }
}

class ResponseFormatError extends UserError {
  constructor(message) {
    super(message, 'RESPONSE_FORMAT_ERROR');
  }
}

module.exports = {
  UserError,
  ConfigurationError,
  ApiError,
  ResponseFormatError,
};
