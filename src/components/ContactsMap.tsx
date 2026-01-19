import React, { useState } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { Contact } from '../types';

interface ContactsMapProps {
  contacts: Contact[];
  onContactClick: (contact: Contact) => void;
}

const ContactsMap: React.FC<ContactsMapProps> = ({ contacts, onContactClick }) => {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const mapContainerStyle = {
    width: '100%',
    height: '100%',
  };

  // Center on first contact with address, or default location
  const center = contacts.length > 0
    ? { lat: 37.7749, lng: -122.4194 } // San Francisco
    : { lat: 40.7128, lng: -74.0060 }; // New York

  return (
    <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={10}
        options={{
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        }}
      >
        {/* TODO: Add markers when contacts have lat/lng coordinates */}
        {selectedContact && (
          <InfoWindow
            position={center}
            onCloseClick={() => setSelectedContact(null)}
          >
            <div className="p-3">
              <h3 className="font-bold text-lg">{selectedContact.name}</h3>
              <p className="text-sm text-gray-600">{selectedContact.role}</p>
              <p className="text-sm">{selectedContact.company}</p>
              <button
                onClick={() => onContactClick(selectedContact)}
                className="mt-2 text-blue-600 text-sm font-medium"
              >
                View Details
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </LoadScript>
  );
};

export default ContactsMap;