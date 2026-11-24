#!/usr/bin/env ruby
# frozen_string_literal: true

# Regenerates memes/memes.json from the images inside the memes/ folder.
# Browser extensions can't list folders at runtime, so the blocked page reads
# this list instead. Run it every time you add or remove meme images:
#
#   ruby tools/build_memes.rb
#
# Works from any directory. Picks up .jpg, .jpeg, .png, .gif and .webp files
# (any letter case):
#   memes/*.jpg       shown in every language (pictures without text)
#   memes/en/*.jpg    shown only when ScrollStopp runs in English
#   memes/de/*.jpg    shown only when ScrollStopp runs in German
# Any folder named like a language code (en, de, fr, pt_BR ...) works the same way.

require 'json'

memes_dir = File.expand_path('../memes', __dir__)
abort "Can't find the memes folder at #{memes_dir}" unless Dir.exist?(memes_dir)

def images_in(dir)
  Dir.children(dir)
     .select { |name| name.match?(/\.(jpe?g|png|gif|webp)\z/i) && File.file?(File.join(dir, name)) }
     .sort_by(&:downcase)
end

result = { 'all' => images_in(memes_dir) }
Dir.children(memes_dir).sort.each do |name|
  next unless name.match?(/\A[a-z]{2,3}(_[A-Z]{2})?\z/) && File.directory?(File.join(memes_dir, name))

  result[name] = images_in(File.join(memes_dir, name)).map { |file| "#{name}/#{file}" }
end

File.write(File.join(memes_dir, 'memes.json'), "#{JSON.pretty_generate(result).gsub(/\[\s+\]/, '[]')}\n")

total = result.values.sum(&:size)
if total.zero?
  puts 'No images found in memes/. The blocked page shows a friendly text instead.'
else
  puts "Wrote memes/memes.json with #{total} meme#{'s' unless total == 1}:"
  result.each do |group, files|
    label = group == 'all' ? 'every language (memes/)' : "#{group} only (memes/#{group}/)"
    puts "  #{files.size} for #{label}"
  end
  puts 'They show up on the next blocked page. If not, reload ScrollStopp in your browser\'s extensions page.'
end
