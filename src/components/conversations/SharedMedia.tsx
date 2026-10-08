import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Lightbox from './Lightbox'
import { FileCard } from './MessageAttachments'
import { sharedMediaKey, useSharedMedia } from '../../hooks/useSharedMedia'
import type { SharedAttachment } from '../../services/api/sharedMedia'
import { resultTime } from '../../utils/searchText'

/** How many of each the info panel shows before See all. */
const PREVIEW_PHOTOS = 6
const PREVIEW_FILES = 3
/** How many See all reads at a time. */
const PAGE_SIZE = 30

/** Three to a row, each opening the viewer at it (Tablet-768-Info-Light). */
const PhotoGrid = ({ photos, onOpen }: { photos: SharedAttachment[]; onOpen: (index: number) => void }) => (
  <ul className='shared-media__grid'>
    {photos.map((photo, index) => (
      <li key={photo.id}>
        <button
          type='button'
          className='shared-media__tile'
          aria-label={`${photo.original_name}, from ${photo.sender?.name ?? 'someone'}, ${resultTime(photo.sent_at)}`}
          onClick={() => onOpen(index)}
        >
          <img src={photo.url} alt='' loading='lazy' decoding='async' />
        </button>
      </li>
    ))}
  </ul>
)

const FileList = ({ files, onRefreshLinks }: { files: SharedAttachment[]; onRefreshLinks: () => void }) => (
  <ul className='shared-media__files'>
    {files.map((file) => (
      <li key={file.id}>
        <FileCard attachment={file} onRefreshLinks={onRefreshLinks} />
      </li>
    ))}
  </ul>
)

/** The links in a list are signed for half an hour: reading the lists again
 * signs them afresh. */
function useRefreshLinks(conversationId: string) {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: sharedMediaKey(conversationId) })
}

type SharedMediaSectionProps = {
  conversationId: string
  onSeeAll: () => void
  /** Where focus goes back to when See all is closed. */
  seeAllRef?: RefObject<HTMLButtonElement | null>
}

/**
 * The info panel's shared media (Tablet-768-Info-Light,
 * Desktop-1280-Group-Member): the newest photos, three to a row, and the
 * newest files, each counted, with See all for the rest. Only what the
 * viewer can see in the history — for someone who left a group, what was
 * sent while they were in it.
 */
export const SharedMediaSection = ({ conversationId, onSeeAll, seeAllRef }: SharedMediaSectionProps) => {
  const headingId = useId()
  const photos = useSharedMedia(conversationId, 'media', PREVIEW_PHOTOS)
  const files = useSharedMedia(conversationId, 'files', PREVIEW_FILES)
  const refreshLinks = useRefreshLinks(conversationId)
  const [viewing, setViewing] = useState<number | null>(null)

  const shownPhotos = photos.data?.pages[0]?.data ?? []
  const shownFiles = files.data?.pages[0]?.data ?? []
  const photoCount = photos.data?.pages[0]?.meta.total ?? 0
  const fileCount = files.data?.pages[0]?.meta.total ?? 0
  const isLoading = photos.isPending || files.isPending
  const failed = !isLoading && (photos.isError || files.isError)

  return (
    <section className='shared-media' aria-labelledby={headingId} aria-busy={isLoading || undefined}>
      <div className='shared-media__head'>
        <h3 id={headingId} className='info-section-title'>
          {isLoading || failed ? 'Shared media' : `Shared media · ${photoCount}`}
        </h3>
        {photoCount + fileCount > 0 && (
          <button ref={seeAllRef} type='button' className='shared-media__see-all' onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className='shared-media__grid' aria-hidden='true'>
          {[0, 1, 2].map((i) => (
            <span key={i} className='shared-media__tile skeleton' />
          ))}
        </div>
      ) : failed ? (
        <p className='shared-media__note'>
          Couldn’t load what’s been shared.{' '}
          <button
            type='button'
            className='shared-media__retry'
            onClick={() => {
              void photos.refetch()
              void files.refetch()
            }}
          >
            Try again
          </button>
        </p>
      ) : photoCount + fileCount === 0 ? (
        <p className='shared-media__note'>Nothing shared yet. Photos and files sent here will show up here.</p>
      ) : (
        <>
          {shownPhotos.length > 0 && <PhotoGrid photos={shownPhotos} onOpen={setViewing} />}
          {fileCount > 0 && (
            <>
              <h3 className='info-section-title shared-media__files-title'>Files · {fileCount}</h3>
              <FileList files={shownFiles} onRefreshLinks={refreshLinks} />
            </>
          )}
        </>
      )}

      {viewing !== null && shownPhotos[viewing] && (
        <Lightbox
          images={shownPhotos}
          index={viewing}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
          onRefreshLinks={refreshLinks}
        />
      )}
    </section>
  )
}

type SharedMediaViewProps = {
  conversationId: string
  /** The back button's name: where it goes ("Back to contact info"). */
  backLabel: string
  onBack: () => void
}

/**
 * See all, in the info panel's place (the panel swaps to it, as the chat
 * list swaps to Archived): every photo, then every file, a page at a time,
 * newest first. Focus starts on the way back.
 */
export const SharedMediaView = ({ conversationId, backLabel, onBack }: SharedMediaViewProps) => {
  const photosId = useId()
  const filesId = useId()
  const photos = useSharedMedia(conversationId, 'media', PAGE_SIZE)
  const files = useSharedMedia(conversationId, 'files', PAGE_SIZE)
  const refreshLinks = useRefreshLinks(conversationId)
  const [viewing, setViewing] = useState<number | null>(null)
  const backRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    backRef.current?.focus()
  }, [])

  const allPhotos = photos.data?.pages.flatMap((page) => page.data) ?? []
  const allFiles = files.data?.pages.flatMap((page) => page.data) ?? []
  const photoCount = photos.data?.pages[0]?.meta.total ?? 0
  const fileCount = files.data?.pages[0]?.meta.total ?? 0

  return (
    <div className='shared-media-view'>
      <div className='info-subhead'>
        <button ref={backRef} type='button' className='info-subhead__back' aria-label={backLabel} onClick={onBack}>
          <Icon name='arrowLeft' size={16} />
        </button>
        <h3 className='info-subhead__title'>Shared media</h3>
      </div>

      <section className='shared-media' aria-labelledby={photosId} aria-busy={photos.isPending || undefined}>
        <h4 id={photosId} className='info-section-title'>
          {photos.isPending ? 'Photos' : `Photos · ${photoCount}`}
        </h4>
        {photos.isError && allPhotos.length === 0 ? (
          <p className='shared-media__note'>Couldn’t load the photos.</p>
        ) : !photos.isPending && photoCount === 0 ? (
          <p className='shared-media__note'>No photos yet.</p>
        ) : (
          <PhotoGrid photos={allPhotos} onOpen={setViewing} />
        )}
        {photos.hasNextPage && (
          <Button
            variant='secondary'
            className='sm shared-media__more'
            loading={photos.isFetchingNextPage}
            onClick={() => void photos.fetchNextPage()}
          >
            Show more photos
          </Button>
        )}
      </section>

      <section className='shared-media' aria-labelledby={filesId} aria-busy={files.isPending || undefined}>
        <h4 id={filesId} className='info-section-title'>
          {files.isPending ? 'Files' : `Files · ${fileCount}`}
        </h4>
        {files.isError && allFiles.length === 0 ? (
          <p className='shared-media__note'>Couldn’t load the files.</p>
        ) : !files.isPending && fileCount === 0 ? (
          <p className='shared-media__note'>No files yet.</p>
        ) : (
          <FileList files={allFiles} onRefreshLinks={refreshLinks} />
        )}
        {files.hasNextPage && (
          <Button
            variant='secondary'
            className='sm shared-media__more'
            loading={files.isFetchingNextPage}
            onClick={() => void files.fetchNextPage()}
          >
            Show more files
          </Button>
        )}
      </section>

      {viewing !== null && allPhotos[viewing] && (
        <Lightbox
          images={allPhotos}
          index={viewing}
          onIndexChange={setViewing}
          onClose={() => setViewing(null)}
          onRefreshLinks={refreshLinks}
        />
      )}
    </div>
  )
}
