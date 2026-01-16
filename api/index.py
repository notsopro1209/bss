from flask import Flask, jsonify, request
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# In-memory storage for macro updates organized by macro name
macro_updates = {}
MAX_UPDATES = 100  # Keep last 100 updates per macro

# Load configured macros from .env
configured_macros = []
for key, value in os.environ.items():
    if key.startswith('MACRO_'):
        try:
            macro_name = key.replace('MACRO_', '')
            int(value)  # Validate it's a number
            configured_macros.append(macro_name)
        except ValueError:
            pass

# Webhook endpoint that Discord bot will POST to
@app.route('/webhook/macro', methods=['POST'])
def receive_webhook():
    try:
        data = request.get_json()
        
        # Discord sends the embeds in the message body
        embeds = data.get('embeds', [])
        content = data.get('content', '')
        author = data.get('author', {})
        macro_name = data.get('macro', 'Unknown')
        
        update = {
            'id': int(datetime.now().timestamp() * 1000),
            'timestamp': datetime.now().isoformat() + 'Z',
            'content': content,
            'embeds': embeds,
            'author': author.get('name', 'Macro Bot')
        }
        
        # Initialize macro if not exists
        if macro_name not in macro_updates:
            macro_updates[macro_name] = []
        
        # Add to the beginning of the list
        macro_updates[macro_name].insert(0, update)
        
        # Keep only the last MAX_UPDATES
        if len(macro_updates[macro_name]) > MAX_UPDATES:
            macro_updates[macro_name] = macro_updates[macro_name][:MAX_UPDATES]
        
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"[{timestamp}] [{macro_name}] Received update: {content or 'Embed message'}")
        
        # Respond to confirm receipt
        return jsonify({'success': True, 'message': 'Macro update received'}), 200
        
    except Exception as error:
        print(f"Webhook error: {error}")
        return jsonify({'success': False, 'error': str(error)}), 400

# API endpoint to get list of all macros
@app.route('/api/macros', methods=['GET'])
def get_macros():
    return jsonify(configured_macros), 200

# API endpoint for the frontend to fetch macro updates
@app.route('/api/updates/<macro_name>', methods=['GET'])
def get_updates(macro_name):
    if macro_name in macro_updates:
        return jsonify(macro_updates[macro_name]), 200
    return jsonify([]), 200

# Get a single update by macro and ID
@app.route('/api/updates/<macro_name>/<int:update_id>', methods=['GET'])
def get_update(macro_name, update_id):
    if macro_name in macro_updates:
        for update in macro_updates[macro_name]:
            if update['id'] == update_id:
                return jsonify(update), 200
    return jsonify({'error': 'Update not found'}), 404

# Clear all updates for a specific macro
@app.route('/api/clear/<macro_name>', methods=['POST'])
def clear_macro_updates(macro_name):
    if macro_name in macro_updates:
        macro_updates[macro_name] = []
    return jsonify({'success': True, 'message': f'Updates cleared for {macro_name}'}), 200

# Clear all updates for all macros
@app.route('/api/clear-all', methods=['POST'])
def clear_all_updates():
    for macro_name in macro_updates:
        macro_updates[macro_name] = []
    return jsonify({'success': True, 'message': 'All updates cleared'}), 200

# Health check endpoint
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

# This is required for Vercel
def handler(request):
    return app(request)
