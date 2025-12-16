// Function to process link values into proper URLs and display formats

export function processLinkValue(linkName: string, value: string): { processedUrl: string; displayValue: string } {
  const name = linkName.toLowerCase();

  switch (name) {
    case 'website':
      // If it's already a URL, return as is
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return { processedUrl: value, displayValue: value };
      }
      // If it's just a domain, add https://
      if (value.includes('.') && !value.startsWith('@')) {
        return { processedUrl: `https://${value}`, displayValue: value };
      }
      return { processedUrl: value, displayValue: value }; // Return as is if it's not a valid URL

    case 'instagram':
      // Handle different input formats
      if (value.includes('instagram.com')) {
        // Already a URL - extract username for display
        const username = value.split('/').pop()?.split('?')[0] || '';
        return { processedUrl: value, displayValue: `@${username}` };
      } else {
        // Username format - remove @ if present and create URL
        const username = value.startsWith('@') ? value.substring(1) : value;
        // Validate username format (Instagram usernames: 1-30 chars, letters, numbers, dots, underscores)
        if (/^[a-zA-Z0-9._]{1,30}$/.test(username)) {
          return { processedUrl: `https://instagram.com/${username}`, displayValue: `@${username}` };
        }
        // If invalid format, return as is
        return { processedUrl: value, displayValue: value };
      }

    case 'facebook':
      if (value.includes('facebook.com')) {
        // Already a URL - extract username for display
        const username = value.split('/').pop()?.split('?')[0] || '';
        return { processedUrl: value, displayValue: `@${username}` };
      } else {
        // Handle @ symbol like Instagram
        const username = value.startsWith('@') ? value.substring(1) : value;
        return { processedUrl: `https://facebook.com/${username}`, displayValue: `@${username}` };
      }

    case 'x':
    case 'twitter':
      if (value.startsWith('@')) {
        const username = value.substring(1);
        return { processedUrl: `https://twitter.com/${username}`, displayValue: value };
      } else if (value.includes('twitter.com') || value.includes('x.com')) {
        // Already a URL - extract username for display
        const username = value.split('/').pop()?.split('?')[0] || '';
        return { processedUrl: value, displayValue: `@${username}` };
      } else {
        return { processedUrl: `https://twitter.com/${value}`, displayValue: `@${value}` };
      }

    case 'youtube':
      if (value.includes('youtube.com') || value.includes('youtu.be')) {
        // Already a URL - extract username for display
        const username = value.split('/').pop()?.split('?')[0] || '';
        return { processedUrl: value, displayValue: `@${username}` };
      } else {
        // Username format - remove @ if present and create URL
        const username = value.startsWith('@') ? value.substring(1) : value;
        return { processedUrl: `https://youtube.com/@${username}`, displayValue: `@${username}` };
      }

    case 'tiktok':
      if (value.startsWith('@')) {
        const username = value.substring(1);
        return { processedUrl: `https://tiktok.com/@${username}`, displayValue: value };
      } else if (value.includes('tiktok.com')) {
        // Already a URL - extract username for display
        const username = value.split('/').pop()?.split('?')[0] || '';
        return { processedUrl: value, displayValue: `@${username}` };
      } else {
        return { processedUrl: `https://tiktok.com/@${value}`, displayValue: `@${value}` };
      }

    case 'linkedin':
      if (value.includes('linkedin.com')) {
        // Already a URL - extract username for display
        const username = value.split('/').pop()?.split('?')[0] || '';
        return { processedUrl: value, displayValue: `@${username}` };
      } else {
        // Handle @ symbol like other social networks
        const username = value.startsWith('@') ? value.substring(1) : value;
        return { processedUrl: `https://linkedin.com/in/${username}`, displayValue: `@${username}` };
      }

    case 'snapchat':
      if (value.startsWith('@')) {
        const username = value.substring(1);
        return { processedUrl: `https://snapchat.com/add/${username}`, displayValue: value };
      } else {
        return { processedUrl: `https://snapchat.com/add/${value}`, displayValue: `@${value}` };
      }

    case 'pinterest':
      if (value.includes('pinterest.com')) {
        // Already a URL - extract username for display
        const username = value.split('/').pop()?.split('?')[0] || '';
        return { processedUrl: value, displayValue: `@${username}` };
      } else {
        // Username format - remove @ if present and create URL
        const username = value.startsWith('@') ? value.substring(1) : value;
        return { processedUrl: `https://pinterest.com/${username}`, displayValue: `@${username}` };
      }

    case 'telegram':
      if (value.startsWith('@')) {
        const username = value.substring(1);
        return { processedUrl: `https://t.me/${username}`, displayValue: value };
      } else {
        return { processedUrl: `https://t.me/${value}`, displayValue: `@${value}` };
      }

    case 'discord':
      if (value.includes('discord.gg') || value.includes('discord.com')) {
        // Already a URL - extract username for display
        const username = value.split('/').pop()?.split('?')[0] || '';
        return { processedUrl: value, displayValue: `@${username}` };
      } else {
        // Username format - remove @ if present and create URL
        const username = value.startsWith('@') ? value.substring(1) : value;
        return { processedUrl: `https://discord.gg/${username}`, displayValue: `@${username}` };
      }

    case 'whatsapp':
      // For WhatsApp, create a WhatsApp API link
      const phoneNumber = value.replace(/\D/g, '');
      if (phoneNumber.length >= 10) {
        return { processedUrl: `https://wa.me/${phoneNumber}`, displayValue: value };
      }
      return { processedUrl: value, displayValue: value };

    case 'phone':
      // For phone numbers, create a tel: link
      const cleanPhone = value.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        return { processedUrl: `tel:${cleanPhone}`, displayValue: value };
      }
      return { processedUrl: value, displayValue: value };

    case 'email':
      // For email, create a mailto: link
      if (value.includes('@')) {
        return { processedUrl: `mailto:${value}`, displayValue: value };
      }
      return { processedUrl: value, displayValue: value };

    case 'location':
      // Location links are already Google Maps URLs, return as is
      return { processedUrl: value, displayValue: value };

    default:
      // For unknown types, try to make it a URL if it looks like one
      if (value.includes('.') && !value.startsWith('@')) {
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          return { processedUrl: `https://${value}`, displayValue: value };
        }
      }
      return { processedUrl: value, displayValue: value };
  }
}

