type HtmlString = string;

type FormatRegexReplacer = {
  matcher: RegExp | string;
  html: HtmlString;
}

export type DatabaseConfig = {
  dialect: "postgresql";
  connection: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    schema?: string;
    ssl?: boolean | {
      rejectUnauthorized: boolean;
      ca?: string;
      key?: string;
      cert?: string;
    };
    poolSize?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };
};

export type StorageConfig = {
  name: string;
  driver: "s3";
  maxFileSize: number;
  acceptedTypes: string[];
  connection: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicUrl: string;
    acl?: "private" | "public_read";
  };
};

// this is ONLY for listing columns of a table and detail of a row, not for the update/create forms
type ColumnListingConfig = {
  isVisible?: boolean;
  placeholderOnNull?: HtmlString;
  renderComponent: {
    type: "text";
    options?: {
      transform?: "uppercase" | "lowercase" | "capitalize";
      trim?: boolean;
      format?: "text" | "link" | "email" | "phone" | "color" | FormatRegexReplacer[];
    }
  } | {
    type: "number";
    options?: {
      decimalPlaces?: number;
      format?: "number" | "percentage" | {
        matcher: RegExp | string;
        html: HtmlString;
      }[];
      showChart?: {
        chart: "bar" | "donut";
        divideBy: number;
      }
    }
  } | {
    type: "datetime";
    options?: {
      format?: "YYYY-MM-DD HH:mm:ss" | "YYYY-MM-DD" | "HH:mm:ss" | string;
      showCalendar?: boolean;
    }
  } | {
    type: "image";
    options?: {
      maxWidth?: string;
      maxHeight?: string;
      allowDownload?: boolean;
      allowPreview?: boolean;
    }
  } | {
    type: "video";
    options?: {
      maxWidth?: string;
      maxHeight?: string;
      controls?: boolean;
      muted?: boolean;
      loop?: boolean;
      allowDownload?: boolean;
      allowPreview?: boolean;
    }
  } | {
    type: "audio";
    options?: {
      controls?: boolean;
      muted?: boolean;
      loop?: boolean;
      allowDownload?: boolean;
      allowPreview?: boolean;
    }
  } | {
    type: "code",
    options?: {
      language?: string;
      showLineNumbers?: boolean;
      wrapLines?: boolean;
    }
  } | {
    type: "enum",
    options?: {
      format?: "text" | "badge" | FormatRegexReplacer[];
    }
  } | {
    type: "boolean",
    options?: {
      format?: "text" | "toggle" | "checkbox" | FormatRegexReplacer[];
    }
  } | {
    type: "array",
    options?: {
      transform?: "uppercase" | "lowercase" | "capitalize";
      trim?: boolean;
      format?: "text" | "badges" | "list" | FormatRegexReplacer[];
    }
  } | {
    type: "blob",
    options?: {
      allowDownload?: boolean;
    }
  } | {
    type: "geo",
    options?: {
      format?: "text" | "map" | "list";
    }
  }
}

// this is ONLY for the add/edit forms
type ColumnAddOrEditConfig = {
  isVisible?: boolean;
  isRequired: boolean;
  isReadOnly?: boolean;
  isArray?: boolean;
  minItems?: number;
  maxItems?: number;
  label?: string;
  defaultValue?: string | number | boolean | string[] | number[] | boolean[];
  renderComponent: {
    // for text data types
    type: "textInput";
    options?: {
      placeholder?: string;
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp | string;
    }
  } | {
    // for text data types
    type: "richTextInput";
    options?: {
      placeholder?: string;
      minLength?: number;
      maxLength?: number;
    }
  } | {
    // for text color data types
    type: "colorPicker";
    options?: {
      format?: "hex" | "rgb" | "rgba";
    }
  } | {
    // for number data types
    type: "numberInput";
    options?: {
      placeholder?: string;
      min?: number;
      max?: number;
      step?: number;
    }
  } | {
    // for text, number and array data types
    type: "selectInput";
    options?: {
      options: {
        label: string;
        value: string | number | boolean;
      }[];
      multiple?: boolean;
    }
  } | {
    // for boolean data types
    type: "checkboxInput";
    options?: {
      options: {
        trueLabel: string;
        falseLabel: string;
      }
    }
  } | {
    // for boolean data types
    type: "toggleInput";
    options?: {
      options: {
        trueLabel: string;
        falseLabel: string;
      }
    }
  } | {
    // for date and datetime data types
    type: "calendarInput";
    options?: {
      format?: "YYYY-MM-DD" | "YYYY-MM-DD HH:mm:ss" | "HH:mm:ss" | string;
      showDate?: boolean;
      showTime?: boolean;
      showTimezone?: boolean;
    }
  } | {
    // for image, video, audio and file data types
    type: "fileUpload";
    options: {
      storageName: string;
      maxFileSize?: number; // must be less than or equal to the maxFileSize in the storage config
      acceptedTypes?: string[]; // must be subset of the acceptedTypes in the storage config
      acl?: "private" | "public_read"; // only used if the storage config is s3 set to public_read
      maxFiles?: number;
      resize?: {
        width?: number;
        height?: number;
        mode: "cover" | "contain" | "fill";
      }
      compress?: {
        quality: number;
      }
      showPreview?: boolean;
    }
  } | {
    // for code data types
    type: "codeEditor";
    options?: {
      language?: string;
      showLineNumbers?: boolean;
      wrapLines?: boolean;
    }
  } | {
    // for geo data types
    type: "mapInput";
    options?: {
      center?: {
        latitude: number;
        longitude: number;
      };
      zoom?: number;
    }
  } | {
    // for relation data types
    type: "oneToOneRelation";
    options: {
      localKey: string;
      foreignTable: string;
      foreignKey: string;
      displayColumns?: string[];
      searchColumns?: string[];
    }
  } | {
    // for relation data types
    type: "oneToManyRelation";
    options: {
      localKey: string;
      foreignTable: string;
      foreignKey: string;
      displayColumns?: string[];
      searchColumns?: string[];
      limit?: number;
    }
  } | {
    // for relation data types
    type: "manyToManyRelation";
    options: {
      localKey: string;
      junctionTable: string;
      junctionLocalKey: string;
      foreignTable: string;
      junctionForeignKey: string;
      displayColumns?: string[];
      searchColumns?: string[];
      limit?: number;
    }
  }
}

type ColumnConfig = {
  columnName: string;
  displayName?: string;
  description?: string;
  isSortable?: boolean;
  isFilterable?: boolean;
  listingConfig?: ColumnListingConfig;
  detailConfig?: ColumnListingConfig;
  addConfig?: ColumnAddOrEditConfig;
  editConfig?: ColumnAddOrEditConfig;
}

type ActionsConfig = {
  allowDelete: boolean;
  allowExport: boolean;
  allowCreate: boolean;
  allowEdit: boolean;
  allowView: boolean;
}

type PaginationConfig = {
  allowPagination: boolean;
  defaultPageSize: number;
  pageSizes: number[];
}

type TableConfig = {
  tableName: string;
  displayName?: string;
  description?: string;
  columns?: ColumnConfig[];
  actions?: ActionsConfig;
  pagination?: PaginationConfig;
}

type MaterializedViewsConfig = {
  name: string;
  displayName?: string;
  description?: string;
  query: string;
  pagination?: PaginationConfig;
  columns?: ColumnConfig[];
  actions?: ActionsConfig;
}

type RoleConfig = {
  name: string;
  tables: {
    name: string | string[] | RegExp;
    permissions: {
      allowRead: boolean;
      allowWrite: boolean;
      allowDelete: boolean;
    }
  }[]
}

type UserConfig = {
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  totpSecret?: string;
  role: string;
}

type AccessControlConfig = {
  passwordAlgorithm?: "pbkdf2" | "bcrypt";
  totpConfig?: {
    algorithm: "sha1" | "sha256" | "sha512";
    digits: number;
    period: number;
  }
  roles: RoleConfig[];
  localUsers?: UserConfig[];
  remoteUsers?: {
    tableName: string;
    columns: UserConfig;
  } 
}

type ThemeConfig = {
  name: string;
  logoUrl?: string;
}

export type Config = {
  theme?: ThemeConfig;
  database: DatabaseConfig;
  storage?: StorageConfig[];
  tables?: TableConfig[];
  materializedViews?: MaterializedViewsConfig[];
  accessControl: AccessControlConfig;
}