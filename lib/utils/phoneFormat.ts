/**
 * Formats a phone number as the user types
 * Formats to: (702) 232-0411
 * 
 * @param value - The input value to format
 * @returns Formatted phone number string
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');
  
  // Limit to 10 digits (US phone number)
  const limitedDigits = digits.slice(0, 10);
  
  // Format based on length
  if (limitedDigits.length === 0) {
    return '';
  } else if (limitedDigits.length <= 3) {
    return `(${limitedDigits}`;
  } else if (limitedDigits.length <= 6) {
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
  } else {
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
  }
}

/**
 * Creates an onChange handler for phone inputs that formats the value
 * 
 * @param setValue - Function to set the formatted value (e.g., setValue from react-hook-form)
 * @param fieldName - Name of the field to update
 * @returns onChange handler function
 */
export function createPhoneOnChangeHandler(
  setValue: (name: string, value: string) => void,
  fieldName: string
) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setValue(fieldName, formatted);
  };
}
